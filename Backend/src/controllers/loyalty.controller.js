/**
 * Rewards points and referrals.
 *   GET   /me/rewards                    customer: balance, history, invite code
 *   GET   /admin/loyalty/ledger          admin: points history (filter by email/type)
 *   POST  /admin/loyalty/adjust          admin: goodwill credit or correction
 *   GET   /admin/referrals               admin: referrals (filter by status)
 *   PATCH /admin/referrals/:id           admin: approve / reject one held for review
 */
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const LoyaltyAccount = require("../models/LoyaltyAccount");
const LoyaltyLedger = require("../models/LoyaltyLedger");
const PlatformSettings = require("../models/PlatformSettings");
const Referral = require("../models/Referral");
const User = require("../models/User");
const {
  addMonths,
  ensureReferralCode,
  getBalance,
  loyaltyConfig,
  payReferral,
  postEntry,
} = require("../lib/loyalty");

const pageOf = (q, max = 100) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

/** Points that will expire within `days` if not spent first (oldest first). */
const expiringWithin = async (userId, days) => {
  const by = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const [row] = await LoyaltyLedger.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $and: [{ $gt: ["$points", 0] }, { $ne: ["$expiresAt", null] }, { $lte: ["$expiresAt", by] }] }, "$points", 0] } },
        debits: { $sum: { $cond: [{ $lt: ["$points", 0] }, { $multiply: ["$points", -1] }, 0] } },
        next: { $min: { $cond: [{ $and: [{ $gt: ["$points", 0] }, { $ne: ["$expiresAt", null] }, { $gt: ["$expiresAt", new Date()] }] }, "$expiresAt", null] } },
      },
    },
  ]);
  return { points: Math.max(0, (row?.credits || 0) - (row?.debits || 0)), by };
};

const getMyRewards = asyncHandler(async (req, res) => {
  const cfg = loyaltyConfig(await PlatformSettings.getOrInit());
  const { page, limit, skip } = pageOf(req.query, 50);
  const balance = await getBalance(req.user.id);
  const user = await User.findById(req.user.id).select("referralCode");

  const [history, total, expiring, invited, rewarded] = await Promise.all([
    LoyaltyLedger.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "orderNumber")
      .lean(),
    LoyaltyLedger.countDocuments({ user: req.user.id }),
    expiringWithin(req.user.id, 30),
    Referral.countDocuments({ referrer: req.user.id }),
    Referral.countDocuments({ referrer: req.user.id, status: "rewarded" }),
  ]);

  const referralOn = cfg.enabled && cfg.referral.enabled;
  res.status(200).json({
    data: {
      enabled: cfg.enabled,
      balance,
      value: balance * cfg.pointValuePence, // pence
      expiringSoon: expiring.points,
      rates: {
        earnPointsPerPound: cfg.earnPointsPerPound,
        pointValuePence: cfg.pointValuePence,
        minRedeemPoints: cfg.minRedeemPoints,
        expiryMonths: cfg.expiryMonths,
      },
      referral: referralOn
        ? {
          code: await ensureReferralCode(user),
          referrerPoints: cfg.referral.referrerPoints,
          friendGets: cfg.referral.refereeCouponValue, // pence off their first order
          friendMinSpend: cfg.referral.refereeMinSubtotal,
          invited,
          rewarded,
        }
        : null,
      history: history.map((h) => ({
        _id: h._id,
        type: h.type,
        points: h.points,
        note: h.note,
        orderNumber: h.order?.orderNumber || null,
        expiresAt: h.expiresAt,
        createdAt: h.createdAt,
      })),
      page,
      limit,
      total,
    },
  });
});

/* ── Admin ───────────────────────────────────────────────────────────── */

const findUserFilter = async (q) => {
  if (q.userId && mongoose.Types.ObjectId.isValid(q.userId)) return { user: q.userId };
  if (q.email) {
    const u = await User.findOne({ email: String(q.email).toLowerCase().trim() }).select("_id");
    return { user: u?._id || new mongoose.Types.ObjectId() };
  }
  return {};
};

const adminLedger = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageOf(req.query);
  const filter = await findUserFilter(req.query);
  if (LoyaltyLedger.TYPES.includes(req.query.type)) filter.type = req.query.type;

  const [rows, total, liability] = await Promise.all([
    LoyaltyLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .populate("order", "orderNumber")
      .lean(),
    LoyaltyLedger.countDocuments(filter),
    LoyaltyAccount.aggregate([{ $group: { _id: null, points: { $sum: "$balance" }, accounts: { $sum: 1 } } }]),
  ]);
  const cfg = loyaltyConfig(await PlatformSettings.getOrInit());
  res.status(200).json({
    page,
    limit,
    total,
    // Unspent points across all customers, and what they'd cost if all spent
    outstanding: {
      points: liability[0]?.points || 0,
      value: (liability[0]?.points || 0) * cfg.pointValuePence,
      accounts: liability[0]?.accounts || 0,
    },
    data: rows,
  });
});

const adminAdjust = asyncHandler(async (req, res) => {
  const { points, note } = req.body || {};
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1000000) {
    throw new ApiError(400, "points must be a non-zero whole number");
  }
  if (typeof note !== "string" || note.trim().length < 3 || note.length > 200) {
    throw new ApiError(400, "Give a reason (3-200 characters)");
  }
  const filter = await findUserFilter(req.body);
  if (!filter.user || !(await User.exists({ _id: filter.user }))) throw new ApiError(404, "Customer not found");

  const cfg = loyaltyConfig(await PlatformSettings.getOrInit());
  const entry = await postEntry({
    user: filter.user,
    type: "adjust",
    points,
    key: `adjust:${new mongoose.Types.ObjectId()}`,
    note: note.trim(),
    expiresAt: points > 0 ? addMonths(new Date(), cfg.expiryMonths) : null,
    createdBy: req.user.id,
  });
  res.status(201).json({ message: "Points adjusted", data: entry });
});

const adminReferrals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageOf(req.query);
  const filter = {};
  if (["pending", "review", "rewarded", "rejected"].includes(req.query.status)) filter.status = req.query.status;
  const [rows, total] = await Promise.all([
    Referral.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("referrer", "name email")
      .populate("referee", "name email status")
      .populate("qualifyingOrder", "orderNumber total")
      .lean(),
    Referral.countDocuments(filter),
  ]);
  res.status(200).json({ page, limit, total, data: rows });
});

const adminReviewReferral = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const { action, note = "" } = req.body || {};
  if (!["approve", "reject"].includes(action)) throw new ApiError(400, "action must be approve or reject");
  const referral = await Referral.findById(req.params.id);
  if (!referral) throw new ApiError(404, "Referral not found");
  if (referral.status !== "review") throw new ApiError(409, `This referral is ${referral.status}, not waiting for review`);

  referral.reviewNote = String(note).slice(0, 300);
  if (action === "approve") {
    await payReferral(referral, { by: req.user.id });
  } else {
    referral.status = "rejected";
    referral.reviewedBy = req.user.id;
    await referral.save();
  }
  res.status(200).json({ message: action === "approve" ? "Referral approved and paid" : "Referral rejected", data: referral });
});

module.exports = { getMyRewards, adminLedger, adminAdjust, adminReferrals, adminReviewReferral };
