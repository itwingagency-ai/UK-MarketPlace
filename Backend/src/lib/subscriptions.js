/**
 * subscriptions.js — repeat orders.
 *
 * Scheduling (pure, testable):
 *   firstRunOn(from, cadence)     first date on or after `from` that fits
 *   advance(date, cadence)        the run after `date`
 *   upcoming(sub, n)              next n run dates, skips left out
 *
 * Running (the scheduler, every 15 minutes, one process at a time):
 *   a subscription is due once its store's local date reaches nextRunOn and
 *   it's past 07:00 there. Each run places a normal order through
 *   placeCartOrders() from a cart-shaped snapshot: live prices, what's in
 *   stock, delivery/collection, the preferred slot if the store has slots,
 *   cash on delivery or an off-session charge on the saved card.
 *   Success -> next date; failure -> try again tomorrow, and after 3
 *   failures in a row the subscription pauses itself. The customer is told
 *   either way.
 */
const crypto = require("crypto");
const Subscription = require("../models/Subscription");
const JobLock = require("../models/JobLock");
const Order = require("../models/Order");
const Store = require("../models/Store");
const User = require("../models/User");
const { addDays, localDate, safeZone, slotsForDate, weekday, zonedToUtc } = require("./slots");

const RUN_FROM_HOUR = 7; // local time: repeat orders are placed from 07:00
const MAX_FAILURES = 3;
const DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

const dayOfWeek = (ymd) => DAY_INDEX[weekday(ymd)];
const dayOfMonth = (ymd) => Number(ymd.slice(8, 10));

/** First date on or after `from` that fits the cadence. */
const firstRunOn = (from, cadence) => {
  for (let i = 0; i < 62; i += 1) {
    const d = addDays(from, i);
    if (cadence.every === "month" ? dayOfMonth(d) === cadence.dayOfMonth : dayOfWeek(d) === cadence.weekday) return d;
  }
  throw new Error("Cadence never matches");
};

/** The run after `date`. Months keep the same day (1-28, so every month has it). */
const advance = (date, cadence) => {
  if (cadence.every === "week") return addDays(date, 7);
  if (cadence.every === "fortnight") return addDays(date, 14);
  return firstRunOn(addDays(date, 1), cadence);
};

/** The next `n` dates this subscription will actually run on. */
const upcoming = (sub, n = 4) => {
  const out = [];
  let d = sub.nextRunOn;
  for (let i = 0; out.length < n && i < 60; i += 1) {
    if (!(sub.skipDates || []).includes(d)) out.push(d);
    d = advance(d, sub.cadence);
  }
  return out;
};

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

/** The slot to book on `date`: the preferred one, else the next free one that day, else ASAP. */
const pickSlot = (store, date, preferredTime, now) => {
  const slots = slotsForDate({ store, date, now }).filter((s) => s.available);
  if (!slots.length) return null;
  const zone = safeZone(store.timezone || "UTC");
  const want = minutesOf(preferredTime);
  if (want == null) return null;
  const at = zonedToUtc(date, want, zone).getTime();
  return slots.find((s) => s.start.getTime() >= at) || null;
};

/** A cart-shaped snapshot placeCartOrders understands. */
const cartFor = (sub, slotStart) => ({
  items: sub.items.map((i) => ({
    _id: crypto.randomUUID(),
    product: i.product,
    store: sub.store,
    variantId: i.variantId || null,
    title: i.title,
    sku: "",
    attributes: {},
    image: "",
    unitPrice: 0,
    compareAtPrice: null,
    quantity: i.quantity,
  })),
  couponCodes: [],
  tips: {},
  notes: sub.note ? { [String(sub.store)]: sub.note } : {},
  declinedFees: {},
  fulfilment: { [String(sub.store)]: { method: sub.method, slotStart: slotStart || null } },
  loyaltyPoints: 0,
  allowSubstitutions: sub.allowSubstitutions !== false,
});

/**
 * Place one subscription's order for `date`. Returns { ok, message, orders }.
 * Never throws: failures are reported in the result.
 */
const placeFor = async (sub, date, now) => {
  // eslint-disable-next-line global-require
  const { placeCartOrders } = require("../controllers/checkout.controller");
  const [store, user] = await Promise.all([
    Store.findById(sub.store).select("name status fulfilment operatingHours timezone"),
    User.findById(sub.user).select("+stripeCustomerId status"),
  ]);
  if (!store || store.status !== "active") return { ok: false, message: "The store isn't taking orders right now" };
  if (!user || user.status !== "active") return { ok: false, message: "Account isn't active", fatal: true };

  const slot = store.fulfilment?.daysAhead > 0 && sub.preferredTime ? pickSlot(store, date, sub.preferredTime, now) : null;
  const body = {
    paymentMethod: sub.paymentMethod === "card" ? "online" : "cod",
    clientType: "subscription",
    ageConfirmed: sub.ageConfirmed === true,
    ...(sub.method === "delivery" ? { shippingAddress: { ...sub.shippingAddress } } : {}),
  };
  const coords = sub.shippingAddress?.lat != null ? { lat: sub.shippingAddress.lat, lng: sub.shippingAddress.lng } : null;

  try {
    const { orders, dropped } = await placeCartOrders({
      userId: sub.user,
      cart: cartFor(sub, slot?.start),
      body,
      deliveryCoords: coords,
      dropUnavailable: true,
      offSession:
        sub.paymentMethod === "card"
          ? { customer: user.stripeCustomerId, paymentMethodId: sub.stripePaymentMethodId, subscriptionId: sub._id }
          : null,
    });
    await Order.updateMany({ _id: { $in: orders.map((o) => o._id) } }, { $set: { subscription: sub._id } });
    const missing = dropped.length ? ` ${dropped.map((d) => d.title).join(", ")} ${dropped.length === 1 ? "wasn't" : "weren't"} available this time.` : "";
    return { ok: true, orders, message: `Order ${orders[0].orderNumber} placed.${missing}` };
  } catch (err) {
    return { ok: false, message: err.message || "Something went wrong" };
  }
};

/** Run one subscription if it's due. Claims it first, so two runners can't both place it. */
const runSubscription = async (subId, now = new Date()) => {
  const sub = await Subscription.findOneAndUpdate(
    {
      _id: subId,
      status: "active",
      $or: [{ runningSince: null }, { runningSince: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } }],
    },
    { $set: { runningSince: now } },
    { new: true }
  );
  if (!sub) return { skipped: "not claimable" };

  // eslint-disable-next-line global-require
  const { notifySubscriptionResult } = require("./appNotifications");
  try {
    const store = await Store.findById(sub.store).select("timezone");
    const zone = safeZone(store?.timezone || "UTC");
    const today = localDate(now, zone);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(now));
    if (sub.nextRunOn > today || (sub.nextRunOn === today && hour < RUN_FROM_HOUR)) return { skipped: "not due" };

    const date = sub.nextRunOn;
    if (sub.skipDates.includes(date)) {
      sub.skipDates = sub.skipDates.filter((d) => d !== date);
      sub.nextRunOn = advance(date, sub.cadence);
      await sub.save();
      return { skipped: "skipped by customer", date };
    }

    const result = await placeFor(sub, date, now);
    sub.lastRunAt = now;
    sub.lastRunOn = date;
    sub.lastResult = { ok: result.ok, message: result.message };
    if (result.ok) {
      sub.failures = 0;
      sub.lastOrder = result.orders[0]._id;
      // Missed days (server down) don't stack up: carry on from today
      let next = advance(date, sub.cadence);
      while (next <= today) next = advance(next, sub.cadence);
      sub.nextRunOn = next;
    } else {
      sub.failures += 1;
      if (result.fatal || sub.failures >= MAX_FAILURES) {
        sub.status = "paused";
        sub.pausedReason = `Paused after ${sub.failures} failed ${sub.failures === 1 ? "try" : "tries"}: ${result.message}`;
      } else {
        sub.nextRunOn = addDays(today, 1); // try again tomorrow
      }
    }
    await sub.save();
    notifySubscriptionResult(sub, result);
    return { date, ...result };
  } finally {
    await Subscription.updateOne({ _id: subId }, { $set: { runningSince: null } });
  }
};

const acquireLock = async (name, ms, owner) => {
  const now = new Date();
  try {
    const lock = await JobLock.findOneAndUpdate(
      { name, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      { $set: { lockedUntil: new Date(now.getTime() + ms), owner } },
      { upsert: true, new: true }
    );
    return lock?.owner === owner;
  } catch (err) {
    if (err?.code === 11000) return false; // someone else holds it
    throw err;
  }
};

/** Run every subscription that's due. Safe to call from several processes. */
const runDueSubscriptions = async (now = new Date()) => {
  const owner = `${process.pid}-${crypto.randomUUID()}`;
  if (!(await acquireLock("subscriptions", 10 * 60 * 1000, owner))) return { ran: 0, locked: true };
  try {
    // Widest possible "today" across timezones; the per-store check is in runSubscription
    const horizon = localDate(new Date(now.getTime() + 14 * 60 * 60 * 1000), "UTC");
    const due = await Subscription.find({ status: "active", nextRunOn: { $lte: horizon } }).select("_id").lean();
    const results = [];
    for (const { _id } of due) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await runSubscription(_id, now));
    }
    return { ran: results.filter((r) => r.ok !== undefined).length, results };
  } finally {
    await JobLock.updateOne({ name: "subscriptions", owner }, { $set: { lockedUntil: null } });
  }
};

let timer = null;
/** Start the in-process scheduler (called from index.js, never in tests). */
const startSubscriptionScheduler = () => {
  if (timer) return;
  const tick = () => runDueSubscriptions().catch((err) => console.error(`[subscriptions] run failed: ${err.message}`));
  setTimeout(tick, 60 * 1000).unref();
  timer = setInterval(tick, 15 * 60 * 1000);
  timer.unref();
};

module.exports = {
  firstRunOn,
  advance,
  upcoming,
  pickSlot,
  cartFor,
  runSubscription,
  runDueSubscriptions,
  startSubscriptionScheduler,
  MAX_FAILURES,
  RUN_FROM_HOUR,
};
