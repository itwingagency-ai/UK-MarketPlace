const {
  buildCommissionSnapshot,
  resolveCommissionConfig,
} = require("./commissionUtils");
const {
  onOrderPaymentFailed,
  onOrderPaymentSucceeded,
} = require("./notificationHooks");
const Order = require("../models/Order");
const PlatformSettings = require("../models/PlatformSettings");
const Product = require("../models/Product");
const PaymentTransaction = require("../models/PaymentTransaction");
const Store = require("../models/Store");

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
  order.commission = buildCommissionSnapshot(config, order.total);
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
    onOrderPaymentSucceeded(order);
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
      order.orderStatus === "delivered"
    ) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await restoreStockForOrder(order);

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
  appendPaymentEvent,
  appendStatusHistory,
  markOrdersPaid,
  cancelOrdersAndRestoreStock,
  recordTransactionEvent,
  finalizeTransaction,
  applyCommissionSnapshot,
  PaymentTransaction,
};
