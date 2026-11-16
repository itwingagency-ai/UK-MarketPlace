/**
 * Live rider position, foreground only, over Socket.IO.
 *
 * The rider app emits "rider:location" { orderId, lat, lng } while an order
 * is out for delivery. We check the rider owns that delivery, pass it on as
 * "order:rider_location" to the customer, the store and the order room, and
 * keep only the latest position on the order (no history), written at most
 * every 30 s. Broadcasts are limited to one per 5 s per order.
 */
const Order = require("../models/Order");

const BROADCAST_MS = 5000;
const PERSIST_MS = 30000;
const lastSent = new Map(); // orderId -> { broadcastAt, persistAt }

const validCoord = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const handleRiderLocation = async (io, socket, payload, ack) => {
  const reply = (body) => (typeof ack === "function" ? ack(body) : undefined);
  try {
    if (socket.user?.role !== "rider") return reply({ error: "Riders only" });
    const orderId = String(payload?.orderId || "");
    const lat = Number(payload?.lat);
    const lng = Number(payload?.lng);
    if (!/^[a-f\d]{24}$/i.test(orderId) || !validCoord(lat, lng)) return reply({ error: "Bad location" });

    const now = Date.now();
    const seen = lastSent.get(orderId) || { broadcastAt: 0, persistAt: 0 };
    if (now - seen.broadcastAt < BROADCAST_MS) return reply({ ok: true, throttled: true });

    const order = await Order.findOne({ _id: orderId, "delivery.rider": socket.user.id, orderStatus: "shipped" })
      .select("customer store")
      .lean();
    if (!order) return reply({ error: "Not your delivery, or not out for delivery" });

    const at = new Date(now);
    seen.broadcastAt = now;
    io.to([`order:${orderId}`, `user:${order.customer}`, `store:${order.store}`, "admin:orders"]).emit(
      "order:rider_location",
      { orderId, lat, lng, at }
    );
    if (now - seen.persistAt >= PERSIST_MS) {
      seen.persistAt = now;
      await Order.updateOne({ _id: orderId }, { $set: { "delivery.lastLocation": { lat, lng, at } } });
    }
    lastSent.set(orderId, seen);
    return reply({ ok: true });
  } catch (_err) {
    return reply({ error: "Server error" });
  }
};

module.exports = { handleRiderLocation };
