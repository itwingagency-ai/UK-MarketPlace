/**
 * The customer's delivery / collection choice for one store order, checked
 * against the store's settings and its live slot capacity.
 */
const SlotBooking = require("../models/SlotBooking");
const { dayLabel, findSlot, fulfilmentOf, localDate, methodEnabled, safeZone } = require("./slots");

/** Store fields fulfilment needs; add to any Store query that feeds this module. */
const STORE_FULFILMENT_FIELDS = "name address fulfilment timezone operatingHours ordersPausedUntil";

const choiceFor = (cart, storeId) => {
  const m = cart?.fulfilment;
  const raw = m instanceof Map ? m.get(String(storeId)) : m?.[String(storeId)];
  return {
    method: raw?.method === "collection" ? "collection" : "delivery",
    slotStart: raw?.slotStart ? new Date(raw.slotStart) : null,
  };
};

/**
 * @returns {Promise<{ method, asap, slotStart, slotEnd, label, issue,
 *   deliveryEnabled, collectionEnabled, schedulingEnabled,
 *   collectionInstructions, collectionAddress }>}
 * `issue` is a customer-facing reason checkout can't go ahead, or null.
 */
const resolveFulfilment = async ({ store, choice, now = new Date() }) => {
  const f = fulfilmentOf(store);
  const name = store?.name || "This store";
  const out = {
    method: choice.method,
    asap: true,
    slotStart: null,
    slotEnd: null,
    label: "As soon as possible",
    issue: null,
    deliveryEnabled: f.deliveryEnabled !== false,
    collectionEnabled: Boolean(f.collectionEnabled),
    schedulingEnabled: f.daysAhead > 0,
    collectionInstructions: f.collectionInstructions || "",
    collectionAddress: choice.method === "collection" ? store?.address || null : null,
  };

  if (!methodEnabled(store, choice.method)) {
    out.issue = choice.method === "collection" ? `${name} doesn't offer collection` : `${name} only offers collection`;
    return out;
  }
  if (!choice.slotStart) return out;

  const row = await SlotBooking.findOne({ store: store._id, slotStart: choice.slotStart }).lean();
  const bookings = new Map(row ? [[choice.slotStart.toISOString(), row.count]] : []);
  const slot = findSlot({ store, slotStart: choice.slotStart, bookings, now });
  if (!slot) {
    out.issue = `Your time slot at ${name} is no longer available. Please pick another`;
    return out;
  }
  if (!slot.available) {
    out.issue = `Your time slot at ${name} is now full. Please pick another`;
    return out;
  }
  const zone = safeZone(store.timezone || "UTC");
  out.asap = false;
  out.slotStart = slot.start;
  out.slotEnd = slot.end;
  out.label = `${dayLabel(localDate(slot.start, zone), localDate(now, zone))}, ${slot.label}`;
  return out;
};

module.exports = { STORE_FULFILMENT_FIELDS, choiceFor, resolveFulfilment };
