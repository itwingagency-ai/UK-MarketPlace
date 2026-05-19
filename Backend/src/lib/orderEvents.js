const { getIO } = require("./socketIO");

/**
 * Broadcast an order event to all relevant Socket.IO rooms.
 *
 * Rooms targeted:
 *   - order:{orderId}   — anyone watching this specific order
 *   - user:{customerId} — the customer who placed the order
 *   - store:{storeId}   — the vendor dashboard for this store
 *   - admin:orders      — platform admins
 *
 * All emitters are fire-and-forget; they never throw.
 */
const broadcastToOrder = (eventName, order, payload) => {
  const io = getIO();
  if (!io) return; // Socket.IO not initialized (e.g. tests)

  const orderId = (order._id || order.id || "").toString();
  const customerId = (order.customer || "").toString();
  const storeId = (order.store || "").toString();

  const rooms = [`order:${orderId}`];
  if (customerId) rooms.push(`user:${customerId}`);
  if (storeId) rooms.push(`store:${storeId}`);
  rooms.push("admin:orders");

  io.to(rooms).emit(eventName, payload);
};

// ── Public emitters ──────────────────────────────────────────────────

const emitOrderCreated = (order) => {
  broadcastToOrder("order:created", order, {
    orderId: (order._id || order.id || "").toString(),
    orderNumber: order.orderNumber,
    storeId: (order.store || "").toString(),
    customerId: (order.customer || "").toString(),
    total: order.total,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt || new Date(),
  });
};

const emitOrderStatusChanged = (order, previousStatus) => {
  broadcastToOrder("order:status_changed", order, {
    orderId: (order._id || order.id || "").toString(),
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    previousStatus,
    updatedAt: order.updatedAt || new Date(),
    note:
      order.statusHistory && order.statusHistory.length
        ? order.statusHistory[order.statusHistory.length - 1].note || ""
        : "",
  });
};

const emitOrderPaymentUpdated = (order) => {
  broadcastToOrder("order:payment_updated", order, {
    orderId: (order._id || order.id || "").toString(),
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    updatedAt: order.updatedAt || new Date(),
  });
};

const emitOrderShipmentEvent = (order, event) => {
  broadcastToOrder("order:shipment_event", order, {
    orderId: (order._id || order.id || "").toString(),
    orderNumber: order.orderNumber,
    event: {
      status: event.status,
      at: event.at,
      location: event.location || "",
      note: event.note || "",
    },
    tracking: {
      carrier: order.tracking?.carrier || "",
      trackingNumber: order.tracking?.trackingNumber || "",
      trackingUrl: order.tracking?.trackingUrl || "",
      shippedAt: order.tracking?.shippedAt || null,
      deliveredAt: order.tracking?.deliveredAt || null,
    },
  });
};

module.exports = {
  emitOrderCreated,
  emitOrderStatusChanged,
  emitOrderPaymentUpdated,
  emitOrderShipmentEvent,
};
