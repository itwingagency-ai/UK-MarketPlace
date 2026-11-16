const {
  buildOrderCommissionSnapshot,
  resolveCommissionConfig,
} = require("./commissionUtils");
const {
  onOrderPaymentFailed,
  onOrderPaymentSucceeded,
  onOrderPlacedToCustomer,
  onOrderPlacedToVendor,
} = require("./notificationHooks");
const { notifyOrderStatus } = require("./appNotifications");
const { checkBackInStock } = require("./stockAlerts");
const { emitOrderStatusChanged } = require("./orderEvents");
const Order = require("../models/Order");
const PlatformSettings = require("../models/PlatformSettings");
const Product = require("../models/Product");
const PaymentTransaction = require("../models/PaymentTransaction");
const Store = require("../models/Store");
const User = require("../models/User");
const { getStripeClient, isStripeConfigured } = require("./stripeClient");
const { releaseCouponRedemptions } = require("./couponRedemptions");
const { releaseSlot } = require("./slotBookings");
const loyalty = require("./loyalty");

const restoreStockForOrder = async (order) => {
  for (const item of order.items || []) {
    if (item.variantId) {
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": Number(item.quantity) } }
      ).catch(() => {});
    } else {
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: Number(item.quantity) } }
      ).catch(() => {});
    }
  }
  // Customers waiting on these items may be able to buy them again
  checkBackInStock((order.items || []).map((item) => item.product));
};

/**
 * Return a cancelled order's items to inventory exactly once. The marker is
 * claimed atomically, so concurrent cancellations cannot restock twice.
 */
const restoreStockForOrderOnce = async (order) => {
  const claimedAt = new Date();
  const claim = await Order.updateOne(
    { _id: order._id, "tracking.stockRestoredAt": null },
    { $set: { "tracking.stockRestoredAt": claimedAt } }
  );
  if (claim.modifiedCount === 0) return false;
  if (order.tracking) order.tracking.stockRestoredAt = claimedAt;
  await restoreStockForOrder(order);
  return true;
};

/**
 * Everything a cancelled order hands back: its stock (exactly once), the
 * coupon uses it held and its time slot. Every cancellation path calls this.
 */
const releaseCancelledOrder = async (order, { reason = "Order cancelled" } = {}) => {
  await restoreStockForOrderOnce(order);
  await releaseCouponRedemptions(order, { reason });
  await releaseSlot(order);
  const platform = await PlatformSettings.getOrInit();
  await loyalty.restoreRedemption(order, loyalty.loyaltyConfig(platform));
};

/**
 * An order reached delivered / collected: credit its points (taking-part
 * stores only) and check whether it completes a referral. Never throws.
 */
const onOrderCompleted = async (order) => {
  try {
    const [platform, store] = await Promise.all([
      PlatformSettings.getOrInit(),
      Store.findById(order.store).select("loyaltyOptIn"),
    ]);
    await loyalty.awardForOrder(order, { cfg: loyalty.loyaltyConfig(platform), store });
    await loyalty.qualifyReferral(order);
  } catch (err) {
    console.error(`[loyalty] completion hook failed for ${order.orderNumber}: ${err.message}`);
  }
};

/**
 * Refund a cancelled order that was paid by card. One Stripe payment can
 * cover several store orders, so each order refunds only its own total.
 *
 * Never throws: a failed refund is recorded on the order (payment stays
 * "paid") so an admin can see it and refund by hand.
 *
 * @returns {Promise<{refunded: boolean, reason?: string}>}
 */
const refundOrderIfPaid = async (order, { by = null, byRole = "system", reason = "" } = {}) => {
  if (order.paymentMethod !== "online" || order.paymentStatus !== "paid") {
    return { refunded: false, reason: "not_paid_online" };
  }

  const recordFailure = async (note) => {
    appendPaymentEvent(order, { status: "paid", provider: "stripe", by, byRole, note });
    await order.save().catch(() => {});
    console.error(`[refund] order ${order.orderNumber}: ${note}`);
    return { refunded: false, reason: note };
  };

  const tx = await PaymentTransaction.findOne({
    orders: order._id,
    provider: "stripe",
    status: { $in: ["succeeded", "refunded"] },
  });
  if (!tx || !tx.providerIntentId) {
    return recordFailure("Refund needed: no Stripe payment found for this order");
  }
  if (!isStripeConfigured()) {
    return recordFailure("Refund needed: Stripe is not configured on this server");
  }

  let refund;
  try {
    refund = await getStripeClient().refunds.create(
      {
        payment_intent: tx.providerIntentId,
        amount: Math.round(Number(order.total)),
        metadata: { orderId: String(order._id), orderNumber: order.orderNumber || "" },
      },
      // Same order can never be refunded twice, even if this runs again
      { idempotencyKey: `refund-order-${order._id}` }
    );
  } catch (err) {
    return recordFailure(`Refund failed: ${err.message}`);
  }

  order.paymentStatus = "refunded";
  // Points earned on a refunded order are taken back
  await loyalty.reverseEarned(order);
  appendPaymentEvent(order, {
    status: "refunded",
    provider: "stripe",
    providerRef: refund.id,
    by,
    byRole,
    note: reason || "Refunded after cancellation",
  });
  await order.save();

  const siblings = await Order.find({ _id: { $in: tx.orders } }).select("paymentStatus");
  const allRefunded = siblings.every((o) => o.paymentStatus === "refunded");
  if (allRefunded) tx.status = "refunded";
  await recordTransactionEvent(tx, {
    type: "stripe.refund.created",
    note: `Refunded ${order.orderNumber} (${refund.id})`,
  });

  return { refunded: true };
};

const appendPaymentEvent = (order, event) => {
  order.paymentEvents.push({
    status: event.status,
    provider: event.provider || "system",
    providerRef: event.providerRef || "",
    by: event.by || null,
    byRole: event.byRole || "",
    at: event.at || new Date(),
    note: event.note || "",
  });
};

const appendStatusHistory = (order, entry) => {
  order.statusHistory.push({
    status: entry.status,
    changedBy: entry.changedBy || null,
    changedByRole: entry.changedByRole || "system",
    changedAt: entry.at || new Date(),
    note: entry.note || "",
  });
};

const applyCommissionSnapshot = async (order) => {
  if (order.commission?.calculatedAt) return;

  const [store, platform] = await Promise.all([
    Store.findById(order.store).select(
      "commissionType commissionRate commissionFixed"
    ),
    PlatformSettings.getOrInit(),
  ]);

  const config = resolveCommissionConfig(store, platform);
  order.commission = buildOrderCommissionSnapshot(config, order);
};

const markOrdersPaid = async ({
  orderIds,
  provider,
  providerRef,
  paidAt = new Date(),
  note = "",
}) => {
  const orders = await Order.find({ _id: { $in: orderIds } });
  for (const order of orders) {
    if (order.paymentStatus === "paid") continue;
    order.paymentStatus = "paid";
    // eslint-disable-next-line no-await-in-loop
    await applyCommissionSnapshot(order);
    appendPaymentEvent(order, {
      status: "paid",
      provider,
      providerRef,
      at: paidAt,
      note: note || "Payment captured",
    });
    // eslint-disable-next-line no-await-in-loop
    await order.save();

    // Payment landed after the order was cancelled: give the money back
    if (order.orderStatus === "cancelled") {
      // eslint-disable-next-line no-await-in-loop
      await refundOrderIfPaid(order, { reason: "Paid after cancellation" });
      continue;
    }
    onOrderPaymentSucceeded(order);

    if (order.paymentMethod === "online") {
      User.findById(order.customer).then((user) => {
        if (user) {
          onOrderPlacedToCustomer(order, user);
          onOrderPlacedToVendor(order, user);
        }
      }).catch(() => {});
    }
  }
};

const cancelOrdersAndRestoreStock = async ({
  orderIds,
  reason,
  provider = "system",
  providerRef = "",
}) => {
  const orders = await Order.find({ _id: { $in: orderIds } });
  for (const order of orders) {
    if (
      order.orderStatus === "cancelled" ||
      Order.COMPLETED_STATUSES.includes(order.orderStatus)
    ) {
      continue;
    }

    const previousStatus = order.orderStatus;
    // eslint-disable-next-line no-await-in-loop
    await releaseCancelledOrder(order, { reason: reason || "Payment failed" });

    order.orderStatus = "cancelled";
    order.paymentStatus = "failed";
    order.tracking = order.tracking || {};
    order.tracking.cancelledAt = new Date();
    order.tracking.cancellationReason =
      reason || order.tracking.cancellationReason || "Payment failed";

    appendStatusHistory(order, {
      status: "cancelled",
      changedByRole: "system",
      note: reason || "Auto-cancelled due to payment failure",
    });
    appendPaymentEvent(order, {
      status: "failed",
      provider,
      providerRef,
      note: reason || "Payment failed",
    });

    // eslint-disable-next-line no-await-in-loop
    await order.save();
    onOrderPaymentFailed(order, { reason });
    emitOrderStatusChanged(order, previousStatus);
    notifyOrderStatus(order);
  }
};

const recordTransactionEvent = async (
  transaction,
  { type, status, note = "", raw = null }
) => {
  transaction.events.push({
    type,
    status: status || transaction.status,
    at: new Date(),
    note,
    raw: raw || null,
  });
  await transaction.save();
};

const finalizeTransaction = async (
  transaction,
  { status, providerIntentId, providerChargeId, failureReason, paidAt }
) => {
  if (status) transaction.status = status;
  if (providerIntentId !== undefined) {
    transaction.providerIntentId = providerIntentId;
  }
  if (providerChargeId !== undefined) {
    transaction.providerChargeId = providerChargeId;
  }
  if (failureReason !== undefined) {
    transaction.failureReason = failureReason;
  }
  if (paidAt !== undefined) {
    transaction.paidAt = paidAt;
  }
  await transaction.save();
};

module.exports = {
  restoreStockForOrder,
  restoreStockForOrderOnce,
  releaseCancelledOrder,
  onOrderCompleted,
  refundOrderIfPaid,
  appendPaymentEvent,
  appendStatusHistory,
  markOrdersPaid,
  cancelOrdersAndRestoreStock,
  recordTransactionEvent,
  finalizeTransaction,
  applyCommissionSnapshot,
  PaymentTransaction,
};
