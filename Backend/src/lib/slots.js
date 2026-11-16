/**
 * slots.js — delivery/collection time slots, derived (never stored) from a
 * store's operatingHours in its own timezone plus Store.fulfilment:
 *
 *   slotLengthMins    window length (default 60)
 *   leadTimeMins      a slot must start at least this far from now
 *   maxOrdersPerSlot  orders per window across both methods (0 = no limit)
 *   daysAhead         days offered, today included (0 = ASAP only, no slots)
 *
 * Capacity is the only stored state: SlotBooking counts orders per
 * (store, slotStart) and is claimed atomically at checkout.
 *
 * Timezones use the built-in Intl API. A store whose timezone Intl doesn't
 * know is treated as UTC.
 */
const { toMinutes } = require("./geoUtils");

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MINUTE = 60 * 1000;

const DEFAULT_FULFILMENT = {
  deliveryEnabled: true,
  collectionEnabled: false,
  slotLengthMins: 60,
  leadTimeMins: 60,
  maxOrdersPerSlot: 0,
  daysAhead: 0,
};

const safeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(0);
    return timeZone;
  } catch (_err) {
    return "UTC";
  }
};

/** Minutes the zone is ahead of UTC at a given instant (BST = 60). */
const zoneOffsetMinutes = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / MINUTE);
};

/** "2026-11-16" + 600 minutes, read as wall-clock time in `timeZone` -> UTC Date. */
const zonedToUtc = (ymd, minutes, timeZone) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  const first = zoneOffsetMinutes(new Date(wall), timeZone);
  const second = zoneOffsetMinutes(new Date(wall - first * MINUTE), timeZone);
  return new Date(wall - second * MINUTE);
};

/** The store-local calendar date of an instant, as "YYYY-MM-DD". */
const localDate = (date, timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const weekday = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

const clock = (date, timeZone) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

const dayLabel = (ymd, today) => {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
};

const fulfilmentOf = (store) => ({ ...DEFAULT_FULFILMENT, ...(store?.fulfilment?.toObject?.() || store?.fulfilment || {}) });

const methodEnabled = (store, method) => {
  const f = fulfilmentOf(store);
  return method === "collection" ? Boolean(f.collectionEnabled) : f.deliveryEnabled !== false;
};

const hoursFor = (operatingHours, day) =>
  operatingHours instanceof Map ? operatingHours.get(day) : (operatingHours || {})[day];

/** The store-local dates slots are offered on, today first. */
const slotDates = (store, now = new Date()) => {
  const f = fulfilmentOf(store);
  const zone = safeZone(store?.timezone || "UTC");
  const today = localDate(now, zone);
  return Array.from({ length: Math.max(0, Math.min(14, f.daysAhead)) }, (_, i) => addDays(today, i));
};

/**
 * Slots for one store-local date.
 * @param {object} p
 * @param {object} p.store     Store doc (fulfilment, operatingHours, timezone)
 * @param {string} p.date      "YYYY-MM-DD" in the store's timezone
 * @param {Map}    [p.bookings] slotStart ISO -> orders already booked
 * @param {Date}   [p.now]
 * @returns {Array<{start: Date, end: Date, label: string, remaining: number|null, available: boolean}>}
 */
const slotsForDate = ({ store, date, bookings = new Map(), now = new Date() }) => {
  const f = fulfilmentOf(store);
  if (!slotDates(store, now).includes(date)) return [];
  const hours = hoursFor(store.operatingHours, weekday(date));
  if (!hours || hours.isClosed) return [];

  const zone = safeZone(store.timezone || "UTC");
  const open = toMinutes(hours.open);
  let close = toMinutes(hours.close);
  if (close <= open) close += 24 * 60; // closes after midnight
  const len = Math.max(15, f.slotLengthMins);
  const earliest = now.getTime() + Math.max(0, f.leadTimeMins) * MINUTE;

  const out = [];
  for (let t = open; t + len <= close; t += len) {
    const start = zonedToUtc(date, t, zone);
    if (start.getTime() < earliest) continue;
    const end = new Date(start.getTime() + len * MINUTE);
    const booked = bookings.get(start.toISOString()) || 0;
    const remaining = f.maxOrdersPerSlot > 0 ? Math.max(0, f.maxOrdersPerSlot - booked) : null;
    out.push({
      start,
      end,
      label: `${clock(start, zone)}–${clock(end, zone)}`,
      remaining,
      available: remaining === null || remaining > 0,
    });
  }
  return out;
};

/** Find the offered slot that starts exactly at `slotStart`, or null. */
const findSlot = ({ store, slotStart, bookings, now = new Date() }) => {
  const zone = safeZone(store?.timezone || "UTC");
  const at = new Date(slotStart);
  if (Number.isNaN(at.getTime())) return null;
  // A slot that starts after midnight can belong to the previous day's hours
  for (const date of [localDate(at, zone), addDays(localDate(at, zone), -1)]) {
    const hit = slotsForDate({ store, date, bookings, now }).find((s) => s.start.getTime() === at.getTime());
    if (hit) return hit;
  }
  return null;
};

module.exports = {
  DEFAULT_FULFILMENT,
  fulfilmentOf,
  methodEnabled,
  slotDates,
  slotsForDate,
  findSlot,
  dayLabel,
  localDate,
  zonedToUtc,
  safeZone,
  addDays,
  weekday,
};
