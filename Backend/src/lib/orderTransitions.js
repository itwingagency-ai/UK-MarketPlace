/**
 * The side effects of an order moving to a new status, shared by everyone who
 * moves orders on (vendor staff, riders). Callers validate the transition
 * first (validators/order.validator) and then call transitionOrder().
 *
 *   shipped    -> shipment timestamps and ETA
 *   delivered / collected -> handover timestamps, cash marked paid with
 *                 commission, points and referral rewards
 *   cancelled  -> stock, coupon uses, slot and points given back; card refunded
 * Then: live socket update, push to the customer, email notifications.
 */
const Order = require("../models/Order");
const {
  appendPaymentEvent,
  applyCommissionSnapshot,
  onOrderCompleted,
  refundOrderIfPaid,
  releaseCancelledOrder,
} = require("./paymentService");
const { computeEstimatedDelivery } = require("./shippingUtils");
const {
  onOrderCancelled,
  onOrderDelivered,
  onOrderPaymentSucceeded,
  onOrderShipped,
} = require("./notificationHooks");
const { notifyOrderStatus } = require("./appNotifications");
const { emitOrderStatusChanged } = require("./orderEvents");

/**
 * @param {object} order   Order document (already loaded)
 * @param {string} nextStatus
 * @param {object} p
 * @param {{id: string, role: string}} p.actor
 * @param {string} [p.note]
 * @param {string} [p.cancelReason]
 * @returns {Promise<{ previousStatus: string, refund: object|null }>}
 */
const transitionOrder = async (order, nextStatus, { actor, note = "", cancelReason = "" }) => {
  const previousStatus = order.orderStatus;
  const now = new Date();
  order.orderStatus = nextStatus;

  if (nextStatus === "shipped" && !order.tracking.shippedAt) {
    order.tracking.shippedAt = now;
    if (order.shippingMethod && (order.shippingMethod.minDays || order.shippingMethod.maxDays)) {
      const eta = computeEstimatedDelivery(order.shippingMethod, now);
      if (eta.earliest && !order.tracking.estimatedDeliveryEarliest) order.tracking.estimatedDeliveryEarliest = eta.earliest;
      if (eta.latest && !order.tracking.estimatedDeliveryLatest) order.tracking.estimatedDeliveryLatest = eta.latest;
    }
    order.tracking.events.push({
      status: "created",
      at: now,
      location: "",
      note: order.tracking.carrier ? `Shipment created via ${order.tracking.carrier}` : "Shipment created",
      by: actor.id,
      byRole: actor.role,
    });
  }
  if (nextStatus === "delivered" && !order.tracking.deliveredAt) {
    order.tracking.deliveredAt = now;
    order.tracking.events.push({
      status: "delivered",
      at: now,
      location: "",
      note: "Order delivered to customer",
      by: actor.id,
      byRole: actor.role,
    });
  }
  if (nextStatus === "cancelled" && !order.tracking.cancelledAt) order.tracking.cancelledAt = now;
  if (nextStatus === "ready_for_collection" && !order.fulfilment.readyAt) order.fulfilment.readyAt = now;
  if (nextStatus === "collected" && !order.fulfilment.collectedAt) order.fulfilment.collectedAt = now;

  // Cash is taken at the door, or at the counter for collections
  if (Order.COMPLETED_STATUSES.includes(nextStatus) && order.paymentMethod === "cod" && order.paymentStatus !== "paid") {
    order.paymentStatus = "paid";
    await applyCommissionSnapshot(order);
    appendPaymentEvent(order, {
      status: "paid",
      provider: "cod",
      by: actor.id,
      byRole: actor.role,
      note: nextStatus === "collected" ? "Cash taken at collection" : "Cash collected on delivery",
    });
  }

  order.statusHistory.push({
    status: nextStatus,
    changedBy: actor.id,
    changedByRole: actor.role,
    changedAt: now,
    note: String(note || "").trim().slice(0, 500),
  });

  await order.save();

  let refund = null;
  if (nextStatus === "cancelled") {
    await releaseCancelledOrder(order, { reason: cancelReason || "Cancelled by the store" });
    refund = await refundOrderIfPaid(order, { by: actor.id, byRole: actor.role, reason: "Refunded after cancellation" });
  }

  // Points and referral rewards are earned only once goods are handed over
  if (Order.COMPLETED_STATUSES.includes(nextStatus)) await onOrderCompleted(order);

  emitOrderStatusChanged(order, previousStatus);
  notifyOrderStatus(order);

  if (nextStatus === "shipped") {
    onOrderShipped(order);
  } else if (nextStatus === "delivered") {
    onOrderDelivered(order);
    if (order.paymentMethod === "cod" && order.paymentStatus === "paid") onOrderPaymentSucceeded(order);
  } else if (nextStatus === "collected") {
    if (order.paymentMethod === "cod" && order.paymentStatus === "paid") onOrderPaymentSucceeded(order);
  } else if (nextStatus === "cancelled") {
    onOrderCancelled(order, {
      reason: String(note || "").trim() || order.tracking?.cancellationReason || cancelReason || "Order cancelled by the store",
    });
  }

  return { previousStatus, refund };
};

module.exports = { transitionOrder };
