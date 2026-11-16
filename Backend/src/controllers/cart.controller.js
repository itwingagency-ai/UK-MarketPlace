const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const {
  buildCartSummary,
  findCartItem,
  getOrCreateCart,
  resolveProductForCart,
} = require("../lib/cartUtils");
const {
  validateAddItemPayload,
  validateUpdateQuantityPayload,
} = require("../validators/cart.validator");
const {
  validateCartOptionsPayload,
  validateCouponCode,
  validateTipPayload,
} = require("../validators/offers.validator");
const { couponBlocker } = require("../lib/offers");
const Coupon = require("../models/Coupon");
const CouponUsage = require("../models/CouponUsage");
const Order = require("../models/Order");
const Store = require("../models/Store");
const { validateCartFulfilmentPayload } = require("../validators/fulfilment.validator");
const { STORE_FULFILMENT_FIELDS, resolveFulfilment } = require("../lib/fulfilment");

const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  const summary = await buildCartSummary(cart);
  res.status(200).json({ data: summary });
});

const addItem = asyncHandler(async (req, res) => {
  validateAddItemPayload(req.body);

  const variantId =
    req.body.variantId !== undefined &&
    req.body.variantId !== null &&
    req.body.variantId !== ""
      ? req.body.variantId
      : null;
  const quantity = req.body.quantity ? Number(req.body.quantity) : 1;

  const resolved = await resolveProductForCart({
    productId: req.body.productId,
    variantId,
  });

  const cart = await getOrCreateCart(req.user.id);
  const existing = findCartItem(cart, resolved.product._id, variantId);

  const targetQty = (existing ? existing.quantity : 0) + quantity;
  if (targetQty > resolved.availableStock) {
    throw new ApiError(
      409,
      `Insufficient stock: only ${resolved.availableStock} available`
    );
  }
  if (targetQty > 999) {
    throw new ApiError(400, "Cart item quantity cannot exceed 999");
  }

  if (existing) {
    existing.quantity = targetQty;
    existing.unitPrice = resolved.unitPrice;
    existing.compareAtPrice = resolved.compareAtPrice;
    existing.title = resolved.title;
    existing.sku = resolved.sku;
    existing.attributes = resolved.attributes;
    existing.image = resolved.image;
  } else {
    cart.items.push({
      product: resolved.product._id,
      store: resolved.storeId,
      variantId,
      title: resolved.title,
      sku: resolved.sku,
      attributes: resolved.attributes,
      image: resolved.image,
      unitPrice: resolved.unitPrice,
      compareAtPrice: resolved.compareAtPrice,
      quantity,
    });
  }

  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({ message: "Item added to cart", data: summary });
});

const updateItemQuantity = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
    throw new ApiError(400, "Invalid cart item id");
  }
  validateUpdateQuantityPayload(req.body);
  const quantity = Number(req.body.quantity);

  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Cart item not found");

  if (quantity === 0) {
    cart.items.pull({ _id: item._id });
    await cart.save();
    const summary = await buildCartSummary(cart);
    return res
      .status(200)
      .json({ message: "Item removed from cart", data: summary });
  }

  const resolved = await resolveProductForCart({
    productId: item.product,
    variantId: item.variantId,
  });

  if (quantity > resolved.availableStock) {
    throw new ApiError(
      409,
      `Insufficient stock: only ${resolved.availableStock} available`
    );
  }

  item.quantity = quantity;
  item.unitPrice = resolved.unitPrice;
  item.compareAtPrice = resolved.compareAtPrice;
  item.title = resolved.title;
  item.sku = resolved.sku;
  item.attributes = resolved.attributes;
  item.image = resolved.image;

  await cart.save();
  const summary = await buildCartSummary(cart);
  return res.status(200).json({ message: "Cart updated", data: summary });
});

const removeItem = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
    throw new ApiError(400, "Invalid cart item id");
  }

  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Cart item not found");

  cart.items.pull({ _id: item._id });
  await cart.save();

  const summary = await buildCartSummary(cart);
  res.status(200).json({ message: "Item removed", data: summary });
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  cart.items = [];
  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({ message: "Cart cleared", data: summary });
});

/* ── Cart intent: codes, tips, options. The client sends what the customer
   chose; every amount comes back computed by lib/offers. ─────────────── */

const storesInCart = (cart) => new Set(cart.items.map((i) => String(i.store)));

/**
 * POST /cart/coupon { code }
 * Rejects codes that can never work for this customer (unknown, expired,
 * used up, first-order-only). A code that just needs a bigger basket is kept
 * and reported as "pending". A new code replaces one in the same slot (the
 * marketplace slot, or the same store's slot).
 */
const applyCoupon = asyncHandler(async (req, res) => {
  validateCouponCode(req.body);
  const code = req.body.code.trim().toUpperCase();

  const coupon = await Coupon.findOne({ code }).lean();
  const [usage, priorOrder] = coupon
    ? await Promise.all([
      CouponUsage.findOne({ coupon: coupon._id, user: req.user.id }).lean(),
      Order.exists({ customer: req.user.id, orderStatus: { $ne: "cancelled" } }),
    ])
    : [null, null];
  const blocker = couponBlocker(coupon, {
    now: new Date(),
    usageCount: usage?.count || 0,
    isFirstOrder: !priorOrder,
    userId: req.user.id,
  });
  if (blocker) throw new ApiError(coupon ? 409 : 404, blocker);

  const cart = await getOrCreateCart(req.user.id);
  const attached = cart.couponCodes.length
    ? await Coupon.find({ code: { $in: cart.couponCodes } }).select("code scope store").lean()
    : [];
  const sameSlot = (c) =>
    c.scope === coupon.scope && (coupon.scope === "platform" || String(c.store) === String(coupon.store));
  const replaced = attached.filter((c) => c.code !== code && sameSlot(c)).map((c) => c.code);
  cart.couponCodes = [...cart.couponCodes.filter((c) => c !== code && !replaced.includes(c)), code];
  await cart.save();

  const summary = await buildCartSummary(cart);
  const status = summary.coupons.find((c) => c.code === code);
  res.status(200).json({
    message: replaced.length
      ? `${code} added in place of ${replaced.join(", ")}`
      : status?.status === "pending"
        ? status.message
        : `${code} applied`,
    data: summary,
  });
});

/** DELETE /cart/coupon/:code */
const removeCoupon = asyncHandler(async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  const cart = await getOrCreateCart(req.user.id);
  if (!cart.couponCodes.includes(code)) throw new ApiError(404, "That code isn't on your basket");
  cart.couponCodes = cart.couponCodes.filter((c) => c !== code);
  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({ message: `${code} removed`, data: summary });
});

/** PUT /cart/tip { storeId, amount } — amount in pence, 0 removes the tip */
const setTip = asyncHandler(async (req, res) => {
  validateTipPayload(req.body);
  const cart = await getOrCreateCart(req.user.id);
  const storeId = String(req.body.storeId);
  if (!storesInCart(cart).has(storeId)) throw new ApiError(400, "That store isn't in your basket");
  if (req.body.amount === 0) cart.tips.delete(storeId);
  else cart.tips.set(storeId, req.body.amount);
  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({ message: req.body.amount ? "Tip added" : "Tip removed", data: summary });
});

/**
 * PUT /cart/options
 * { allowSubstitutions?, stores?: [{ storeId, note?, bags? }] }
 * bags: false switches off the removable bag charge for that store.
 */
const setCartOptions = asyncHandler(async (req, res) => {
  validateCartOptionsPayload(req.body);
  const cart = await getOrCreateCart(req.user.id);
  if (req.body.allowSubstitutions !== undefined) cart.allowSubstitutions = req.body.allowSubstitutions;

  const inCart = storesInCart(cart);
  for (const entry of req.body.stores || []) {
    const storeId = String(entry.storeId);
    if (!inCart.has(storeId)) throw new ApiError(400, "That store isn't in your basket");
    if (entry.note !== undefined) {
      const note = entry.note.trim();
      if (note) cart.notes.set(storeId, note);
      else cart.notes.delete(storeId);
    }
    if (entry.bags !== undefined) {
      const declined = new Set(cart.declinedFees.get(storeId) || []);
      if (entry.bags) declined.delete("bag");
      else declined.add("bag");
      if (declined.size) cart.declinedFees.set(storeId, [...declined]);
      else cart.declinedFees.delete(storeId);
    }
  }
  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({ message: "Basket updated", data: summary });
});

/**
 * PUT /cart/fulfilment { storeId, method: "delivery" | "collection", slotStart }
 * slotStart null = as soon as possible. The slot must be one the store
 * offers right now; capacity is claimed for real only at checkout.
 */
const setFulfilment = asyncHandler(async (req, res) => {
  validateCartFulfilmentPayload(req.body);
  const cart = await getOrCreateCart(req.user.id);
  const storeId = String(req.body.storeId);
  if (!storesInCart(cart).has(storeId)) throw new ApiError(400, "That store isn't in your basket");

  const store = await Store.findById(storeId).select(STORE_FULFILMENT_FIELDS);
  if (!store) throw new ApiError(404, "Store not found");
  const choice = {
    method: req.body.method,
    slotStart: req.body.slotStart ? new Date(req.body.slotStart) : null,
  };
  const resolved = await resolveFulfilment({ store, choice });
  if (resolved.issue) throw new ApiError(409, resolved.issue);

  cart.fulfilment.set(storeId, choice);
  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({
    message: choice.method === "collection" ? `Collect from ${store.name}: ${resolved.label}` : `Delivery: ${resolved.label}`,
    data: summary,
  });
});

/**
 * PUT /cart/loyalty { points } — points to spend, 0 to stop using them.
 * The server caps it (balance, per-checkout maximum, the goods at taking-part
 * stores) and the summary says how many are actually being used.
 */
const setLoyaltyPoints = asyncHandler(async (req, res) => {
  const points = req.body?.points;
  if (!Number.isInteger(points) || points < 0 || points > 10000000) {
    throw new ApiError(400, "points must be a whole number, 0 or more");
  }
  const cart = await getOrCreateCart(req.user.id);
  cart.loyaltyPoints = points;
  await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({
    message: points ? summary.loyalty?.message || `Using ${summary.loyalty?.appliedPoints || 0} points` : "Not using points",
    data: summary,
  });
});

module.exports = {
  setLoyaltyPoints,
  setFulfilment,
  applyCoupon,
  removeCoupon,
  setTip,
  setCartOptions,
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
