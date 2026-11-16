/**
 * Slot capacity: claimed with the orders at checkout, released on cancel.
 * See lib/slots.js for how the slots themselves are derived.
 */
const ApiError = require("./ApiError");
const Order = require("../models/Order");
const SlotBooking = require("../models/SlotBooking");
const { fulfilmentOf } = require("./slots");

/** slotStart ISO -> orders booked, for one store between two instants. */
const bookingsBetween = async (storeId, from, to) => {
  const rows = await SlotBooking.find({ store: storeId, slotStart: { $gte: from, $lt: to } }).lean();
  return new Map(rows.map((r) => [new Date(r.slotStart).toISOString(), r.count]));
};

/**
 * Book a place in its slot for every scheduled order. Pass `session` inside
 * the placement transaction; otherwise call the returned undo() on failure.
 * @param {Map} storesById  storeId -> Store doc (for maxOrdersPerSlot and name)
 */
const claimSlots = async ({ orders, storesById, session = null }) => {
  const opts = session ? { session } : {};
  const claimed = [];
  const undo = async () => {
    for (const c of claimed) {
      // eslint-disable-next-line no-await-in-loop
      await SlotBooking.updateOne({ ...c, count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});
    }
  };
  try {
    for (const order of orders) {
      const f = order.fulfilment;
      if (!f || f.asap || !f.slotStart) continue;
      const store = storesById.get(String(order.store));
      const max = fulfilmentOf(store).maxOrdersPerSlot;
      const key = { store: order.store, slotStart: f.slotStart };
      try {
        // eslint-disable-next-line no-await-in-loop
        await SlotBooking.findOneAndUpdate(
          max > 0 ? { ...key, count: { $lt: max } } : key,
          { $inc: { count: 1 } },
          { ...opts, upsert: true }
        );
      } catch (err) {
        if (err?.code === 11000) {
          throw new ApiError(409, `That time slot at ${store?.name || "the store"} has just filled up. Please pick another time`);
        }
        throw err;
      }
      claimed.push(key);
    }
  } catch (err) {
    if (!session) await undo();
    throw err;
  }
  return { undo };
};

/** Give a cancelled order's slot back, exactly once. Never throws. */
const releaseSlot = async (order) => {
  try {
    const f = order.fulfilment;
    if (!f || f.asap || !f.slotStart) return;
    const claim = await Order.updateOne(
      { _id: order._id, "fulfilment.slotReleasedAt": null },
      { $set: { "fulfilment.slotReleasedAt": new Date() } }
    );
    if (claim.modifiedCount === 0) return;
    await SlotBooking.updateOne(
      { store: order.store, slotStart: f.slotStart, count: { $gt: 0 } },
      { $inc: { count: -1 } }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[slots] release failed for order ${order.orderNumber || order._id}: ${err.message}`);
  }
};

module.exports = { bookingsBetween, claimSlots, releaseSlot };
