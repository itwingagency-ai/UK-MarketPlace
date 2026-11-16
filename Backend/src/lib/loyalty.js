/**
 * loyalty.js — rewards points and referrals.
 *
 * Money rules (plan §3 Wave 3, owner defaults §5):
 *   earn    1 point per £1 of goods actually paid for (subtotal - discounts),
 *           on delivered / collected orders at taking-part stores only
 *   spend   100 points = £1, as a "loyalty" price line, platform-funded, so
 *           the store's payout and commission are untouched
 *   expire  12 months after earning, first in first out
 *
 * Every balance change writes one LoyaltyLedger entry with an idempotency key
 * and moves LoyaltyAccount.balance in the same step, so the balance always
 * equals the sum of the ledger.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiError = require("./ApiError");
const LoyaltyAccount = require("../models/LoyaltyAccount");
const LoyaltyLedger = require("../models/LoyaltyLedger");

const DEFAULTS = {
  enabled: false,
  earnPointsPerPound: 1,
  pointValuePence: 1,
  minRedeemPoints: 100,
  maxRedeemPoints: 0,
  minBasketToRedeem: 0,
  expiryMonths: 12,
  referral: { enabled: false, referrerPoints: 500, refereeCouponValue: 500, refereeMinSubtotal: 1500 },
};
const CREDIT_TYPES = ["earn", "referral", "restore", "adjust"];

const loyaltyConfig = (settings) => {
  const raw = settings?.toObject ? settings.toObject().loyalty : settings?.loyalty;
  return { ...DEFAULTS, ...(raw || {}), referral: { ...DEFAULTS.referral, ...(raw?.referral || {}) } };
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

/** Points for an amount of goods paid for (pence). */
const pointsForSpend = (pence, cfg) => Math.max(0, Math.floor((Math.max(0, pence) / 100) * cfg.earnPointsPerPound));

/** Goods the customer paid for on an order: subtotal less every reduction. */
const goodsPaid = (order) => Math.max(0, Number(order.subtotal || 0) - Number(order.discountTotal || 0));

/**
 * Write one ledger entry and move the balance with it.
 * Credits are always applied; a debit is applied only if the balance covers
 * it (throws 409), unless `clampToBalance` debits whatever is there.
 * Returns the entry, or null when `key` was already written (idempotent).
 */
const postEntry = async ({ user, type, points, key, order = null, note = "", expiresAt = null, createdBy = null, session = null, clampToBalance = false }) => {
  if (!Number.isInteger(points) || points === 0) return null;
  const opts = session ? { session } : {};
  if (await LoyaltyLedger.exists({ key }).session(session || null)) return null;

  let applied = points;
  if (points < 0) {
    const need = -points;
    let account = await LoyaltyAccount.findOneAndUpdate(
      { user, balance: { $gte: need } },
      { $inc: { balance: -need } },
      { ...opts, new: true }
    );
    if (!account && clampToBalance) {
      const current = await LoyaltyAccount.findOne({ user }).session(session || null);
      const take = Math.min(need, current?.balance || 0);
      if (take === 0) return null;
      account = await LoyaltyAccount.findOneAndUpdate(
        { user, balance: { $gte: take } },
        { $inc: { balance: -take } },
        { ...opts, new: true }
      );
      applied = -take;
    }
    if (!account) throw new ApiError(409, "You don't have enough points for that any more");
  } else {
    await LoyaltyAccount.findOneAndUpdate(
      { user },
      { $inc: { balance: points, ...(["earn", "referral"].includes(type) ? { lifetimeEarned: points } : {}) } },
      { ...opts, upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  try {
    const [entry] = await LoyaltyLedger.create(
      [{ user, type, points: applied, key, order, note, expiresAt, createdBy }],
      opts
    );
    return entry;
  } catch (err) {
    // Another request wrote the same key first: undo our balance move
    if (err?.code === 11000) {
      await LoyaltyAccount.updateOne({ user }, { $inc: { balance: -applied } }, opts);
      return null;
    }
    throw err;
  }
};

/**
 * Expire points that are older than their expiry and still unspent.
 * Spending uses the oldest points first, so:
 *   due = credits already past expiry - everything spent, reversed or expired so far
 * Idempotent: once written, the expiry counts as spent and the next run finds 0.
 */
const syncExpiry = async (userId, now = new Date()) => {
  const [row] = await LoyaltyLedger.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: null,
        expiredCredits: {
          $sum: {
            $cond: [
              { $and: [{ $in: ["$type", CREDIT_TYPES] }, { $gt: ["$points", 0] }, { $ne: ["$expiresAt", null] }, { $lte: ["$expiresAt", now] }] },
              "$points",
              0,
            ],
          },
        },
        debits: { $sum: { $cond: [{ $lt: ["$points", 0] }, { $multiply: ["$points", -1] }, 0] } },
      },
    },
  ]);
  const due = Math.max(0, (row?.expiredCredits || 0) - (row?.debits || 0));
  if (due === 0) return 0;
  const entry = await postEntry({
    user: userId,
    type: "expire",
    points: -due,
    key: `expire:${userId}:${now.toISOString()}`,
    note: "Points older than the expiry period",
    clampToBalance: true,
  });
  return entry ? -entry.points : 0;
};

/** Balance after expiring anything due. */
const getBalance = async (userId) => {
  if (!userId) return 0;
  await syncExpiry(userId);
  const account = await LoyaltyAccount.findOne({ user: userId }).lean();
  return account?.balance || 0;
};

/**
 * Spend the points on freshly created orders (order.loyalty.pointsRedeemed).
 * Inside the placement transaction pass `session`; otherwise use undo().
 */
const claimRedemption = async ({ orders, userId, session = null }) => {
  const posted = [];
  const undo = async () => {
    for (const p of posted) {
      // eslint-disable-next-line no-await-in-loop
      await LoyaltyLedger.deleteOne({ _id: p._id }).catch(() => {});
      // eslint-disable-next-line no-await-in-loop
      await LoyaltyAccount.updateOne({ user: userId }, { $inc: { balance: -p.points } }).catch(() => {});
    }
  };
  try {
    for (const order of orders) {
      const points = Number(order.loyalty?.pointsRedeemed || 0);
      if (!points) continue;
      // eslint-disable-next-line no-await-in-loop
      const entry = await postEntry({
        user: userId,
        type: "redeem",
        points: -points,
        key: `redeem:${order._id}`,
        order: order._id,
        note: `Spent on ${order.orderNumber}`,
        session,
      });
      if (entry) posted.push(entry);
    }
  } catch (err) {
    if (!session) await undo();
    throw err;
  }
  return { undo };
};

/** A cancelled order gives its spent points back (with a fresh expiry). Never throws. */
const restoreRedemption = async (order, cfg = DEFAULTS) => {
  try {
    const points = Number(order.loyalty?.pointsRedeemed || 0);
    if (!points || !order.customer) return;
    await postEntry({
      user: order.customer,
      type: "restore",
      points,
      key: `restore:${order._id}`,
      order: order._id,
      note: `Returned from cancelled ${order.orderNumber}`,
      expiresAt: addMonths(new Date(), cfg.expiryMonths),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[loyalty] restore failed for ${order.orderNumber || order._id}: ${err.message}`);
  }
};

/**
 * Credit points for a completed order at a taking-part store. Idempotent.
 * Never throws.
 */
const awardForOrder = async (order, { cfg, store }) => {
  try {
    if (!cfg.enabled || !store?.loyaltyOptIn || !order.customer) return 0;
    const points = pointsForSpend(goodsPaid(order), cfg);
    if (!points) return 0;
    const entry = await postEntry({
      user: order.customer,
      type: "earn",
      points,
      key: `earn:${order._id}`,
      order: order._id,
      note: `Earned on ${order.orderNumber}`,
      expiresAt: addMonths(new Date(), cfg.expiryMonths),
    });
    if (!entry) return 0;
    // eslint-disable-next-line global-require
    const Order = require("../models/Order");
    await Order.updateOne({ _id: order._id }, { $set: { "loyalty.pointsEarned": points, "loyalty.earnedAt": new Date() } });
    return points;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[loyalty] award failed for ${order.orderNumber || order._id}: ${err.message}`);
    return 0;
  }
};

/** Take back points earned on an order that was later refunded. Never throws. */
const reverseEarned = async (order) => {
  try {
    const points = Number(order.loyalty?.pointsEarned || 0);
    if (!points || !order.customer) return;
    await postEntry({
      user: order.customer,
      type: "reverse",
      points: -points,
      key: `reverse:${order._id}`,
      order: order._id,
      note: `Refunded ${order.orderNumber}`,
      clampToBalance: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[loyalty] reverse failed for ${order.orderNumber || order._id}: ${err.message}`);
  }
};

/* ── Referrals ───────────────────────────────────────────────────────── */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const randomCode = (n) =>
  Array.from(crypto.randomBytes(n), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

/** The customer's invite code, made the first time it's asked for. */
const ensureReferralCode = async (user) => {
  if (user.referralCode) return user.referralCode;
  // eslint-disable-next-line global-require
  const User = require("../models/User");
  for (let i = 0; i < 5; i += 1) {
    const code = randomCode(7);
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await User.updateOne({ _id: user._id, referralCode: { $exists: false } }, { $set: { referralCode: code } });
      // eslint-disable-next-line no-await-in-loop
      if (res.modifiedCount === 1) return code;
      // eslint-disable-next-line no-await-in-loop
      const fresh = await User.findById(user._id).select("referralCode").lean();
      if (fresh?.referralCode) return fresh.referralCode;
    } catch (err) {
      if (err?.code !== 11000) throw err; // code taken: try another
    }
  }
  throw new ApiError(500, "Couldn't create an invite code, please try again");
};

/**
 * At sign-up: link the new customer to whoever invited them and give them a
 * one-person welcome coupon (platform-funded, first order only), added to
 * their basket. Throws 400 for a code that doesn't exist.
 */
const startReferral = async ({ referee, code, cfg }) => {
  /* eslint-disable global-require */
  const User = require("../models/User");
  const Referral = require("../models/Referral");
  const Coupon = require("../models/Coupon");
  const { getOrCreateCart } = require("./cartUtils");
  /* eslint-enable global-require */
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  if (!cfg.enabled || !cfg.referral.enabled) return null;

  const referrer = await User.findOne({ referralCode: normalized, status: "active" }).select("_id");
  if (!referrer) throw new ApiError(400, "That invite code isn't valid");
  if (String(referrer._id) === String(referee._id)) return null;
  if (await Referral.exists({ referee: referee._id })) return null;

  let couponCode = "";
  if (cfg.referral.refereeCouponValue > 0) {
    couponCode = `WELCOME-${randomCode(6)}`;
    await Coupon.create({
      code: couponCode,
      description: "Welcome gift from a friend",
      scope: "platform",
      type: "fixed",
      value: cfg.referral.refereeCouponValue,
      minSubtotal: cfg.referral.refereeMinSubtotal,
      usageLimit: 1,
      perUserLimit: 1,
      firstOrderOnly: true,
      fundedBy: "platform",
      allowedUser: referee._id,
    });
    const cart = await getOrCreateCart(referee._id);
    if (!cart.couponCodes.includes(couponCode)) {
      cart.couponCodes.push(couponCode);
      await cart.save();
    }
  }

  return Referral.create({
    referrer: referrer._id,
    referee: referee._id,
    code: normalized,
    couponCode,
    rewardPoints: cfg.referral.referrerPoints,
  });
};

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");

/** Fraud checks: does the referee look like the referrer under another account? */
const referralFlags = async (referral, order) => {
  // eslint-disable-next-line global-require
  const User = require("../models/User");
  const [referrer, referee] = await Promise.all([
    User.findById(referral.referrer).select("phone addresses +pushTokens").lean(),
    User.findById(referral.referee).select("phone addresses status +pushTokens").lean(),
  ]);
  const flags = [];
  if (referrer?.phone && referee?.phone && norm(referrer.phone) === norm(referee.phone)) flags.push("same_phone");
  const addressKey = (a) => (a?.line1 && a?.postalCode ? `${norm(a.line1)}|${norm(a.postalCode)}` : null);
  const referrerAddresses = new Set((referrer?.addresses || []).map(addressKey).filter(Boolean));
  const orderAddress = addressKey(order.shippingAddress);
  if ((orderAddress && referrerAddresses.has(orderAddress)) || (referee?.addresses || []).some((a) => referrerAddresses.has(addressKey(a)))) {
    flags.push("same_address");
  }
  const tokens = new Set((referrer?.pushTokens || []).map((t) => t.token));
  if ((referee?.pushTokens || []).some((t) => tokens.has(t.token))) flags.push("same_device");
  return { flags, refereeVerified: referee?.status === "active" };
};

/** Pay the referrer (idempotent per referral). */
const payReferral = async (referral, { by = null } = {}) => {
  const entry = await postEntry({
    user: referral.referrer,
    type: "referral",
    points: referral.rewardPoints,
    key: `referral:${referral._id}`,
    note: "A friend you invited completed their first order",
    expiresAt: addMonths(new Date(), loyaltyConfig(await getSettings()).expiryMonths),
  });
  referral.status = "rewarded";
  referral.rewardedAt = new Date();
  if (by) referral.reviewedBy = by;
  await referral.save();
  return entry;
};

const getSettings = async () => {
  // eslint-disable-next-line global-require
  const PlatformSettings = require("../models/PlatformSettings");
  return PlatformSettings.getOrInit();
};

/**
 * Called when an order completes. If it's the referee's first completed
 * order, pay the referrer, or hold for review when a fraud check matches.
 * Never throws.
 */
const qualifyReferral = async (order) => {
  try {
    /* eslint-disable global-require */
    const Referral = require("../models/Referral");
    const Order = require("../models/Order");
    /* eslint-enable global-require */
    const referral = await Referral.findOne({ referee: order.customer, status: "pending" });
    if (!referral) return null;
    const earlier = await Order.exists({
      customer: order.customer,
      _id: { $ne: order._id },
      orderStatus: { $in: Order.COMPLETED_STATUSES },
    });
    if (earlier) return null;

    referral.qualifyingOrder = order._id;
    const { flags, refereeVerified } = await referralFlags(referral, order);
    if (!refereeVerified) flags.push("unverified_referee");
    referral.flags = flags;
    if (flags.length) {
      referral.status = "review";
      await referral.save();
      return referral;
    }
    await payReferral(referral);
    return referral;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[loyalty] referral check failed for ${order.orderNumber || order._id}: ${err.message}`);
    return null;
  }
};

module.exports = {
  DEFAULTS,
  loyaltyConfig,
  pointsForSpend,
  goodsPaid,
  postEntry,
  syncExpiry,
  getBalance,
  claimRedemption,
  restoreRedemption,
  awardForOrder,
  reverseEarned,
  ensureReferralCode,
  startReferral,
  qualifyReferral,
  payReferral,
  addMonths,
};
