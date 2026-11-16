const User = require("../models/User");
const { getIO } = require("./socketIO");
const { sendPushToUsers } = require("./pushService");
const { formatClock } = require("./storeAvailability");

/**
 * Alerts shown inside the mobile app. Each one goes two ways:
 *   - a Socket.IO "app:notification" event to the user's room, which the app
 *     turns into a banner while it is running;
 *   - an Expo push notification, which reaches the phone when the app is
 *     closed (once push credentials are configured).
 * All functions are fire-and-forget and never throw.
 */

const money = (pence) => `£${(Number(pence || 0) / 100).toFixed(2)}`;

const deliver = (userIds, notification) => {
  try {
    const io = getIO();
    if (io) {
      for (const id of userIds) io.to(`user:${id}`).emit("app:notification", notification);
    }
  } catch (_err) {
    // socket delivery is best effort
  }
  sendPushToUsers(userIds, notification);
};

const safely = (label, fn) =>
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[app-notifications] ${label} failed:`, err?.message || err);
    });

/** New order → every shopkeeper account of that store. */
const notifyNewOrder = (order) =>
  safely("new order", async () => {
    const vendors = await User.find({ storeId: order.store, role: "vendor", status: "active" }).select("_id").lean();
    if (vendors.length === 0) return;
    const items = (order.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0);
    deliver(vendors.map((v) => String(v._id)), {
      title: `New order · ${money(order.total)}`,
      body: `#${order.orderNumber} · ${items} item${items === 1 ? "" : "s"} from ${order.customerSnapshot?.name || "a customer"}`,
      data: { type: "order:new", orderId: String(order._id), orderNumber: order.orderNumber },
      channelId: "orders",
    });
  });

const STATUS_COPY = {
  confirmed: (o) => {
    const ready = o.tracking?.estimatedReadyAt;
    return ready
      ? `Your order has been accepted and should be ready by ${formatClock(ready)}.`
      : "Your order has been accepted.";
  },
  packed: () => "Your order is packed and will be on its way soon.",
  shipped: () => "Your order is out for delivery.",
  delivered: () => "Your order has been delivered. Enjoy!",
  ready_for_collection: () => "Your order is ready to collect. Tap \"I've arrived\" when you get there.",
  collected: () => "Order collected. Thanks for shopping with us!",
  cancelled: () => "Your order was cancelled. You have not been charged for unavailable items.",
};

/** A collecting customer is outside → the store's phones. */
const notifyCustomerArrived = (order) =>
  safely("customer arrived", async () => {
    const vendors = await User.find({ storeId: order.store, role: "vendor", status: "active" }).select("_id").lean();
    if (vendors.length === 0) return;
    const note = order.fulfilment?.arrivalNote;
    deliver(vendors.map((v) => String(v._id)), {
      title: `Customer outside · #${order.orderNumber}`,
      body: `${order.customerSnapshot?.name || "Your customer"} is here to collect${note ? ` (${note})` : ""}.`,
      data: { type: "order:arrived", orderId: String(order._id), orderNumber: order.orderNumber },
      channelId: "orders",
    });
  });

/** Order status change → the customer who placed it. */
const notifyOrderStatus = (order) =>
  safely("order status", async () => {
    const copy = STATUS_COPY[order.orderStatus];
    if (!copy || !order.customer) return;
    deliver([String(order.customer)], {
      title: `Order #${order.orderNumber}`,
      body: copy(order),
      data: { type: "order:status", orderId: String(order._id), orderStatus: order.orderStatus },
      channelId: "orders",
    });
  });

/** A product (or one of its sizes) a customer asked about is available again. */
const notifyBackInStock = (userIds, { product, variantLabel, storeName }) =>
  safely("back in stock", async () => {
    deliver(userIds.map(String), {
      title: "Back in stock",
      body: `${product.title}${variantLabel ? ` (${variantLabel})` : ""} is available again${storeName ? ` at ${storeName}` : ""}.`,
      data: { type: "stock:back", productId: String(product._id) },
    });
  });

module.exports = {
  notifyCustomerArrived,
  notifyBackInStock,
  notifyNewOrder,
  notifyOrderStatus,
};
