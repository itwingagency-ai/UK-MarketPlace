/**
 * Coupons and automatic offers, managed by vendors (own store only) and
 * admins (platform-wide or for a store). Mounted at
 *   /api/v1/vendor/dashboard/{coupons,promotions}   (vendor: store scope)
 *   /api/v1/admin/{coupons,promotions}              (admin)
 *
 * Funding rules (plan §3 / §5):
 *   vendor-made           -> scope store, fundedBy vendor (forced)
 *   admin, scope platform -> fundedBy platform (forced by the model)
 *   admin, scope store    -> fundedBy as chosen, default platform
 * Money in and out of this API is integer pence.
 */
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");
const Product = require("../models/Product");
const Promotion = require("../models/Promotion");
const Store = require("../models/Store");
const {
  validateCouponPayload,
  validatePromotionPayload,
} = require("../validators/offers.validator");

const isAdmin = (req) => req.user.role === "admin";

const vendorStoreId = (req) => {
  if (!req.storeScopeId) throw new ApiError(403, "No store scope resolved for this request");
  return req.storeScopeId;
};

const toDateOrNull = (v) => (v === undefined ? undefined : v ? new Date(v) : null);

const throwValidation = (err) => {
  if (err?.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    throw new ApiError(400, first?.message || "Invalid data");
  }
  if (err?.code === 11000) throw new ApiError(409, "That code is already taken");
  throw err;
};

/** Pick the editable fields; admins also choose scope, store and funding. */
const couponFields = (req, body) => {
  const out = {};
  for (const f of ["description", "type", "value", "maxDiscount", "minSubtotal", "usageLimit", "perUserLimit", "firstOrderOnly", "isActive"]) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  if (body.code !== undefined) out.code = body.code.trim().toUpperCase();
  const startsAt = toDateOrNull(body.startsAt);
  const endsAt = toDateOrNull(body.endsAt);
  if (startsAt !== undefined) out.startsAt = startsAt;
  if (endsAt !== undefined) out.endsAt = endsAt;
  if (out.type === "free_delivery") out.value = 0;

  if (isAdmin(req)) {
    if (body.scope !== undefined) out.scope = body.scope;
    if (body.store !== undefined) out.store = body.store || null;
    if (body.fundedBy !== undefined) out.fundedBy = body.fundedBy;
  } else {
    out.scope = "store";
    out.store = vendorStoreId(req);
    out.fundedBy = "vendor";
  }
  return out;
};

const scopeFilter = (req) => {
  if (!isAdmin(req)) return { store: vendorStoreId(req) };
  const f = {};
  if (req.query.scope) f.scope = req.query.scope;
  if (req.query.storeId && mongoose.Types.ObjectId.isValid(req.query.storeId)) f.store = req.query.storeId;
  return f;
};

const findInScope = async (Model, req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const doc = await Model.findOne({ _id: req.params.id, ...(isAdmin(req) ? {} : { store: vendorStoreId(req) }) });
  if (!doc) throw new ApiError(404, "Not found");
  return doc;
};

// Creating something that has already ended is always a mistake
const assertNotEnded = (fields) => {
  if (fields.endsAt && fields.endsAt <= new Date()) throw new ApiError(400, "The end date is in the past");
};

const assertStoreExists = async (storeId) => {
  if (storeId && !(await Store.exists({ _id: storeId }))) throw new ApiError(400, "Store not found");
};

/* ── Coupons ─────────────────────────────────────────────────────────── */

const listCoupons = asyncHandler(async (req, res) => {
  const filter = scopeFilter(req);
  if (req.query.q) filter.code = { $regex: String(req.query.q).replace(/[^A-Za-z0-9_-]/g, ""), $options: "i" };
  const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).limit(500).populate("store", "name slug").lean();

  const stats = coupons.length
    ? await CouponRedemption.aggregate([
      { $match: { coupon: { $in: coupons.map((c) => c._id) }, status: "active" } },
      { $group: { _id: "$coupon", discountTotal: { $sum: "$amount" }, orders: { $sum: 1 } } },
    ])
    : [];
  const statsById = new Map(stats.map((s) => [String(s._id), s]));

  res.status(200).json({
    data: coupons.map((c) => ({
      ...c,
      uses: c.redemptionCount,
      ordersDiscounted: statsById.get(String(c._id))?.orders || 0,
      discountTotal: statsById.get(String(c._id))?.discountTotal || 0,
    })),
  });
});

const createCoupon = asyncHandler(async (req, res) => {
  validateCouponPayload(req.body, { isAdmin: isAdmin(req) });
  const fields = couponFields(req, req.body);
  if (isAdmin(req) && fields.scope === "store" && !fields.fundedBy) fields.fundedBy = "platform";
  assertNotEnded(fields);
  await assertStoreExists(fields.store);
  const coupon = await Coupon.create({ ...fields, createdBy: req.user.id }).catch(throwValidation);
  res.status(201).json({ message: "Coupon created", data: coupon });
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await findInScope(Coupon, req);
  validateCouponPayload({ type: coupon.type, ...req.body }, { isUpdate: true, isAdmin: isAdmin(req) });
  const fields = couponFields(req, req.body);
  // Once used, a coupon's identity is fixed: orders and reports refer to it
  if (coupon.redemptionCount > 0 || (await CouponRedemption.exists({ coupon: coupon._id }))) {
    for (const locked of ["code", "type", "scope", "store", "fundedBy"]) {
      if (fields[locked] !== undefined && String(fields[locked]) !== String(coupon[locked])) {
        throw new ApiError(409, `This coupon has been used, so its ${locked} can't change. Create a new coupon instead`);
      }
    }
  }
  await assertStoreExists(fields.store);
  coupon.set(fields);
  await coupon.save().catch(throwValidation);
  res.status(200).json({ message: "Coupon updated", data: coupon });
});

/** Unused coupons are deleted; used ones are switched off so history stays intact. */
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await findInScope(Coupon, req);
  if (await CouponRedemption.exists({ coupon: coupon._id })) {
    coupon.isActive = false;
    await coupon.save();
    return res.status(200).json({ message: "Coupon has been used, so it was switched off instead of deleted", data: coupon });
  }
  await coupon.deleteOne();
  return res.status(200).json({ message: "Coupon deleted", data: { _id: coupon._id } });
});

/**
 * Redemption report. Query: couponId, storeId (admin), status, from, to, page, limit.
 * Totals are split by who funds the discount.
 */
const listRedemptions = asyncHandler(async (req, res) => {
  const filter = isAdmin(req) ? {} : { store: new mongoose.Types.ObjectId(String(vendorStoreId(req))) };
  if (isAdmin(req) && req.query.storeId && mongoose.Types.ObjectId.isValid(req.query.storeId)) {
    filter.store = new mongoose.Types.ObjectId(req.query.storeId);
  }
  if (req.query.couponId && mongoose.Types.ObjectId.isValid(req.query.couponId)) {
    filter.coupon = new mongoose.Types.ObjectId(req.query.couponId);
  }
  filter.status = ["active", "released"].includes(req.query.status) ? req.query.status : "active";
  const range = {};
  if (req.query.from && !Number.isNaN(new Date(req.query.from).getTime())) range.$gte = new Date(req.query.from);
  if (req.query.to && !Number.isNaN(new Date(req.query.to).getTime())) range.$lte = new Date(req.query.to);
  if (Object.keys(range).length) filter.createdAt = range;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

  const [rows, total, totals] = await Promise.all([
    CouponRedemption.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("order", "orderNumber total orderStatus paymentStatus createdAt")
      .populate("store", "name slug")
      .populate("user", "name email")
      .lean(),
    CouponRedemption.countDocuments(filter),
    CouponRedemption.aggregate([
      { $match: filter },
      { $group: { _id: "$fundedBy", amount: { $sum: "$amount" }, orders: { $sum: 1 } } },
    ]),
  ]);

  const byFunder = { platform: { amount: 0, orders: 0 }, vendor: { amount: 0, orders: 0 } };
  for (const t of totals) byFunder[t._id] = { amount: t.amount, orders: t.orders };

  res.status(200).json({
    page,
    limit,
    total,
    totals: { ...byFunder, amount: byFunder.platform.amount + byFunder.vendor.amount },
    data: rows.map((r) => ({
      ...r,
      // Vendors don't need the customer's email to read their discount report
      user: isAdmin(req) ? r.user : { name: r.user?.name || "" },
    })),
  });
});

/* ── Automatic offers ────────────────────────────────────────────────── */

const promotionFields = (req, body) => {
  const out = {};
  for (const f of ["type", "minSubtotal", "discountType", "discountValue", "maxDiscount", "buyQuantity", "getQuantity", "products", "categories", "isActive"]) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  if (body.name !== undefined) out.name = body.name.trim();
  const startsAt = toDateOrNull(body.startsAt);
  const endsAt = toDateOrNull(body.endsAt);
  if (startsAt !== undefined) out.startsAt = startsAt;
  if (endsAt !== undefined) out.endsAt = endsAt;
  if (isAdmin(req)) {
    if (body.scope !== undefined) out.scope = body.scope;
    if (body.store !== undefined) out.store = body.store || null;
    if (body.fundedBy !== undefined) out.fundedBy = body.fundedBy;
  } else {
    out.scope = "store";
    out.store = vendorStoreId(req);
    out.fundedBy = "vendor";
  }
  return out;
};

/** A store offer may only target that store's own products. */
const assertProductsInStore = async (fields) => {
  if (fields.scope !== "store" || !fields.products?.length) return;
  const n = await Product.countDocuments({ _id: { $in: fields.products }, store: fields.store });
  if (n !== new Set(fields.products.map(String)).size) {
    throw new ApiError(400, "Offers can only include this store's own products");
  }
};

const listPromotions = asyncHandler(async (req, res) => {
  const promotions = await Promotion.find(scopeFilter(req))
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("store", "name slug")
    .populate("products", "title")
    .lean();
  res.status(200).json({ data: promotions });
});

const createPromotion = asyncHandler(async (req, res) => {
  validatePromotionPayload(req.body, { isAdmin: isAdmin(req) });
  const fields = promotionFields(req, req.body);
  if (isAdmin(req) && fields.scope === "store" && !fields.fundedBy) fields.fundedBy = "platform";
  assertNotEnded(fields);
  await assertStoreExists(fields.store);
  await assertProductsInStore(fields);
  const promo = await Promotion.create({ ...fields, createdBy: req.user.id }).catch(throwValidation);
  res.status(201).json({ message: "Offer created", data: promo });
});

const updatePromotion = asyncHandler(async (req, res) => {
  const promo = await findInScope(Promotion, req);
  validatePromotionPayload(req.body, { isUpdate: true, isAdmin: isAdmin(req) });
  const fields = promotionFields(req, req.body);
  await assertStoreExists(fields.store);
  await assertProductsInStore({ scope: promo.scope, store: promo.store, ...fields });
  promo.set(fields);
  await promo.save().catch(throwValidation);
  res.status(200).json({ message: "Offer updated", data: promo });
});

// Placed orders keep the offer's name and amount on their price lines,
// so an offer can be deleted without touching history.
const deletePromotion = asyncHandler(async (req, res) => {
  const promo = await findInScope(Promotion, req);
  await promo.deleteOne();
  res.status(200).json({ message: "Offer deleted", data: { _id: promo._id } });
});

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listRedemptions,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
