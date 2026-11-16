/**
 * Repeat orders.
 *   Customer (/customer/subscriptions):
 *     POST   /                 from one of my orders { orderId, every, weekday | dayOfMonth,
 *                              preferredTime?, paymentMethod: cod | card, paymentMethodId?, startOn?, ageConfirmed? }
 *     GET    /                 mine, with the next few dates
 *     PATCH  /:id              { action: pause | resume | cancel | skip | unskip, date? }
 *                              or changes { every, weekday, dayOfMonth, preferredTime, quantities, paymentMethod, paymentMethodId }
 *   Customer: POST /me/payment-methods/setup   SetupIntent to save a card for repeat orders
 *   Vendor:   GET /vendor/dashboard/subscriptions/upcoming?days=14
 */
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Subscription = require("../models/Subscription");
const Order = require("../models/Order");
const Store = require("../models/Store");
const User = require("../models/User");
const PlatformSettings = require("../models/PlatformSettings");
const { firstRunOn, upcoming } = require("../lib/subscriptions");
const { localDate, safeZone } = require("../lib/slots");
const { getStripeClient, isStripeConfigured } = require("../lib/stripeClient");
const { ensureStripeCustomer, savedCardAccess } = require("../lib/stripeCustomer");

const EVERY = ["week", "fortnight", "month"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseCadence = (body, current = {}) => {
  const every = body.every ?? current.every;
  if (!EVERY.includes(every)) throw new ApiError(400, "every must be week, fortnight or month");
  if (every === "month") {
    const d = Number(body.dayOfMonth ?? current.dayOfMonth);
    if (!Number.isInteger(d) || d < 1 || d > 28) throw new ApiError(400, "dayOfMonth must be 1-28");
    return { every, weekday: null, dayOfMonth: d };
  }
  const w = Number(body.weekday ?? current.weekday);
  if (!Number.isInteger(w) || w < 0 || w > 6) throw new ApiError(400, "weekday must be 0 (Sunday) to 6 (Saturday)");
  return { every, weekday: w, dayOfMonth: null };
};

/** A card the customer saved with us for off-session use, checked to be theirs. */
const ownCard = async (userId, paymentMethodId) => {
  if (!isStripeConfigured()) throw new ApiError(503, "Card payments aren't set up");
  if (typeof paymentMethodId !== "string" || !paymentMethodId.startsWith("pm_")) throw new ApiError(400, "Choose a saved card");
  const user = await User.findById(userId).select("+stripeCustomerId");
  const pm = await getStripeClient().paymentMethods.retrieve(paymentMethodId).catch(() => null);
  if (!pm || !user?.stripeCustomerId || pm.customer !== user.stripeCustomerId) throw new ApiError(404, "Card not found");
  return { id: pm.id, label: `${String(pm.card?.brand || "card").toUpperCase()} •••• ${pm.card?.last4 || ""}` };
};

const view = (sub) => ({ ...sub.toObject(), upcoming: sub.status === "active" ? upcoming(sub, 4) : [] });

const createSubscription = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(b.orderId)) throw new ApiError(400, "Pick the order to repeat");
  const order = await Order.findOne({ _id: b.orderId, customer: req.user.id });
  if (!order) throw new ApiError(404, "Order not found");
  const items = order.items
    .filter((i) => ["ok", "substituted"].includes(i.lineStatus || "ok"))
    .map((i) => ({ product: i.product, variantId: i.variantId, title: i.title, quantity: Math.min(99, i.quantity) }));
  if (!items.length) throw new ApiError(400, "That order has nothing to repeat");
  if (order.ageCheck > 0 && b.ageConfirmed !== true) {
    throw new ApiError(400, `This has over-${order.ageCheck} items: please confirm you're ${order.ageCheck} or over`);
  }

  const store = await Store.findOne({ _id: order.store, status: "active" }).select("timezone");
  if (!store) throw new ApiError(409, "That store isn't taking orders");
  const cadence = parseCadence(b);
  if (b.preferredTime && !TIME_RE.test(b.preferredTime)) throw new ApiError(400, "preferredTime must be HH:mm");
  const today = localDate(new Date(), safeZone(store.timezone || "UTC"));
  const startOn = b.startOn && DATE_RE.test(b.startOn) && b.startOn > today ? b.startOn : localDate(new Date(Date.now() + 86400000), safeZone(store.timezone || "UTC"));

  const { features = {} } = await PlatformSettings.getOrInit();
  let card = null;
  if (b.paymentMethod === "card") {
    if (features.onlinePaymentEnabled === false) throw new ApiError(400, "Card payments are currently unavailable");
    card = await ownCard(req.user.id, b.paymentMethodId);
  } else if (b.paymentMethod === "cod") {
    if (features.codEnabled === false) throw new ApiError(400, "Cash on delivery is currently unavailable");
  } else {
    throw new ApiError(400, "paymentMethod must be cod or card");
  }

  const sub = await Subscription.create({
    user: req.user.id,
    store: order.store,
    items,
    cadence,
    nextRunOn: firstRunOn(startOn, cadence),
    method: order.fulfilment?.method || "delivery",
    preferredTime: b.preferredTime || "",
    shippingAddress: order.fulfilment?.method === "collection" ? undefined : order.shippingAddress?.toObject?.() || order.shippingAddress,
    note: order.customerNote || "",
    allowSubstitutions: order.allowSubstitutions !== false,
    ageConfirmed: order.ageCheck > 0,
    paymentMethod: b.paymentMethod,
    stripePaymentMethodId: card?.id || "",
    cardLabel: card?.label || "",
  });
  res.status(201).json({ message: "Repeat order set up", data: view(sub) });
});

const listMine = asyncHandler(async (req, res) => {
  const subs = await Subscription.find({ user: req.user.id, status: { $ne: "cancelled" } })
    .sort({ createdAt: -1 })
    .populate("store", "name slug")
    .populate("lastOrder", "orderNumber orderStatus");
  res.status(200).json({ data: subs.map(view) });
});

const updateMine = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const sub = await Subscription.findOne({ _id: req.params.id, user: req.user.id });
  if (!sub || sub.status === "cancelled") throw new ApiError(404, "Repeat order not found");
  const b = req.body || {};
  const store = await Store.findById(sub.store).select("timezone");
  const today = localDate(new Date(), safeZone(store?.timezone || "UTC"));
  let message = "Repeat order updated";

  switch (b.action) {
    case "pause":
      sub.status = "paused";
      sub.pausedReason = "Paused by you";
      message = "Paused. Nothing will be ordered until you resume";
      break;
    case "resume":
      if (sub.status !== "paused") throw new ApiError(409, "It isn't paused");
      sub.status = "active";
      sub.pausedReason = "";
      sub.failures = 0;
      // Pick up from the next fitting date, never one in the past
      sub.nextRunOn = firstRunOn(sub.nextRunOn > today ? sub.nextRunOn : addOne(today), sub.cadence);
      message = "Resumed";
      break;
    case "cancel":
      sub.status = "cancelled";
      message = "Cancelled. Orders already placed aren't affected";
      break;
    case "skip":
    case "unskip": {
      const date = b.date || upcoming(sub, 1)[0];
      if (!DATE_RE.test(String(date))) throw new ApiError(400, "date must be YYYY-MM-DD");
      if (b.action === "skip") {
        if (!upcoming(sub, 12).includes(date)) throw new ApiError(400, "That isn't one of the next delivery dates");
        sub.skipDates = [...new Set([...sub.skipDates, date])];
        message = `Skipping ${date}`;
      } else {
        sub.skipDates = sub.skipDates.filter((d) => d !== date);
        message = `${date} is back on`;
      }
      break;
    }
    case undefined: {
      if (b.every !== undefined || b.weekday !== undefined || b.dayOfMonth !== undefined) {
        sub.cadence = parseCadence(b, sub.cadence);
        sub.nextRunOn = firstRunOn(addOne(today), sub.cadence);
        sub.skipDates = [];
      }
      if (b.preferredTime !== undefined) {
        if (b.preferredTime && !TIME_RE.test(b.preferredTime)) throw new ApiError(400, "preferredTime must be HH:mm");
        sub.preferredTime = b.preferredTime || "";
      }
      if (Array.isArray(b.quantities)) {
        b.quantities.forEach((q, i) => {
          if (!sub.items[i]) return;
          if (!Number.isInteger(q) || q < 0 || q > 99) throw new ApiError(400, "Quantities must be 0-99");
          sub.items[i].quantity = q;
        });
        sub.items = sub.items.filter((i) => i.quantity > 0);
        if (!sub.items.length) throw new ApiError(400, "Keep at least one item, or cancel the repeat order");
      }
      if (b.paymentMethod === "cod") {
        sub.paymentMethod = "cod";
        sub.stripePaymentMethodId = "";
        sub.cardLabel = "";
      } else if (b.paymentMethod === "card") {
        const card = await ownCard(req.user.id, b.paymentMethodId);
        sub.paymentMethod = "card";
        sub.stripePaymentMethodId = card.id;
        sub.cardLabel = card.label;
      }
      break;
    }
    default:
      throw new ApiError(400, "action must be pause, resume, cancel, skip or unskip");
  }
  await sub.save();
  res.status(200).json({ message, data: view(sub) });
});

function addOne(ymd) {
  // eslint-disable-next-line global-require
  return require("../lib/slots").addDays(ymd, 1);
}

/** SetupIntent so the customer can save a card the store may charge later. */
const setupCardForRepeatOrders = asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) throw new ApiError(503, "Card payments aren't set up");
  const user = await User.findById(req.user.id);
  const customer = await ensureStripeCustomer(user);
  const access = await savedCardAccess(user);
  const intent = await getStripeClient().setupIntents.create({
    customer,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { userId: String(user._id), purpose: "repeat_orders" },
  });
  res.status(200).json({
    data: {
      setupIntentClientSecret: intent.client_secret,
      customerId: customer,
      customerEphemeralKeySecret: access?.ephemeralKey || null,
    },
  });
});

/** Vendor: repeat orders coming up, so they can plan stock. */
const vendorUpcoming = asyncHandler(async (req, res) => {
  if (!req.storeScopeId) throw new ApiError(400, "Pick a store first");
  const days = Math.min(42, Math.max(1, parseInt(req.query.days, 10) || 14));
  const store = await Store.findById(req.storeScopeId).select("timezone");
  const zone = safeZone(store?.timezone || "UTC");
  const today = localDate(new Date(), zone);
  const until = localDate(new Date(Date.now() + days * 86400000), zone);
  const subs = await Subscription.find({ store: req.storeScopeId, status: "active" }).populate("user", "name").lean();

  const rows = [];
  for (const sub of subs) {
    for (const date of upcoming(sub, 12)) {
      if (date < today || date > until) continue;
      rows.push({
        date,
        subscriptionId: sub._id,
        customerName: sub.user?.name || "Customer",
        method: sub.method,
        preferredTime: sub.preferredTime,
        paymentMethod: sub.paymentMethod,
        items: sub.items.map((i) => ({ title: i.title, quantity: i.quantity })),
      });
    }
  }
  rows.sort((a, b) => (a.date === b.date ? (a.preferredTime || "").localeCompare(b.preferredTime || "") : a.date.localeCompare(b.date)));
  res.status(200).json({ data: rows, from: today, until });
});

module.exports = { createSubscription, listMine, updateMine, setupCardForRepeatOrders, vendorUpcoming };
