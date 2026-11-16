/**
 * offers.js — turns a cart's intent (coupon codes, tips, declined fees) plus
 * the platform's rules (promotions, fee settings) into price lines, then has
 * lib/pricing.priceStoreGroup do the arithmetic for each store order.
 *
 * priceCart() is pure: give it documents, it returns numbers. loadOfferContext()
 * fetches those documents. Everything is integer pence.
 *
 * ── Rules ───────────────────────────────────────────────────────────────────
 * Order of lines on a store order (each reduction capped by what is left):
 *   1. automatic promotion (at most one per store order: the best for the customer)
 *   2. the store's coupon (at most one per store)
 *   3. the platform coupon (at most one per cart, spread across store orders)
 *   4. fees: small-order, service (platform revenue), bags (store, removable)
 *   5. tip (store, never carries commission)
 * Percent and fixed discounts reduce goods only; free_delivery reduces delivery.
 * Fees are computed on goods before discounts, so a coupon never changes a fee.
 *
 * Coupon status:
 *   applied  - discount is on the bill
 *   pending  - valid, but not usable yet (spend more, or add that store's items)
 *   invalid  - expired, used up, not for this customer...; never discounts
 */
const { priceStoreGroup } = require("./pricing");
const { poundsToPence } = require("./money");

const pounds = (pence) => `£${(Number(pence || 0) / 100).toFixed(2)}`;
const sumBy = (arr, fn) => arr.reduce((acc, x) => acc + fn(x), 0);
const percentOf = (amount, pct) => Math.round((amount * pct) / 100);
const mapGet = (m, key) => {
  if (!m) return undefined;
  if (m instanceof Map) return m.get(String(key));
  return m[String(key)];
};

/** Split `total` across `weights` in proportion, as integers that add up exactly. */
const allocate = (total, weights) => {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, x) => a + x, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (weights[i] > 0) {
      out[i] += 1;
      left -= 1;
    }
  }
  return out;
};

const isLive = (doc, now) =>
  doc.isActive !== false &&
  (!doc.startsAt || new Date(doc.startsAt) <= now) &&
  (!doc.endsAt || new Date(doc.endsAt) > now);

/** Reasons a coupon can never apply to this customer right now; null if none. */
const couponBlocker = (coupon, { now, usageCount = 0, isFirstOrder = true }) => {
  if (!coupon) return "We don't recognise that code";
  if (coupon.isActive === false) return "This code is no longer active";
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return "This code isn't active yet";
  if (coupon.endsAt && new Date(coupon.endsAt) <= now) return "This code has expired";
  if (coupon.usageLimit != null && Number(coupon.redemptionCount || 0) >= coupon.usageLimit) {
    return "This code has been fully used";
  }
  if (usageCount >= (coupon.perUserLimit || 1)) return "You've already used this code";
  if (coupon.firstOrderOnly && !isFirstOrder) return "This code is for your first order only";
  return null;
};

const itemMatches = (promo, item) => {
  const products = promo.products || [];
  const categories = promo.categories || [];
  if (products.length === 0 && categories.length === 0) return true;
  if (products.some((id) => String(id) === String(item.product))) return true;
  return Boolean(item.category) && categories.some((id) => String(id) === String(item.category));
};

/** What a promotion is worth on a store order's items, and how close it is otherwise. */
const evaluatePromotion = (promo, items) => {
  const eligible = items.filter((item) => itemMatches(promo, item));
  if (promo.type === "multibuy") {
    const bundle = promo.buyQuantity + promo.getQuantity;
    const units = [];
    for (const item of eligible) {
      for (let q = 0; q < item.quantity; q += 1) units.push(Number(item.unitPrice));
    }
    units.sort((a, b) => a - b);
    const free = Math.floor(units.length / bundle) * promo.getQuantity;
    const amount = units.slice(0, free).reduce((a, p) => a + p, 0);
    const rem = units.length % bundle;
    const unitsNeeded = units.length > 0 && rem >= promo.buyQuantity ? bundle - rem : 0;
    return { amount, unitsNeeded, gap: 0 };
  }

  const eligibleSubtotal = sumBy(eligible, (i) => Number(i.unitPrice) * i.quantity);
  if (eligibleSubtotal < promo.minSubtotal) {
    return { amount: 0, gap: promo.minSubtotal - eligibleSubtotal, unitsNeeded: 0 };
  }
  let amount =
    promo.discountType === "percent" ? percentOf(eligibleSubtotal, promo.discountValue) : promo.discountValue;
  if (promo.maxDiscount != null) amount = Math.min(amount, promo.maxDiscount);
  return { amount: Math.min(amount, eligibleSubtotal), gap: 0, unitsNeeded: 0 };
};

const couponDiscountOn = (coupon, { goodsLeft, shipLeft }) => {
  if (coupon.type === "free_delivery") return { goods: 0, ship: shipLeft };
  let goods = coupon.type === "percent" ? percentOf(goodsLeft, coupon.value) : coupon.value;
  if (coupon.maxDiscount != null) goods = Math.min(goods, coupon.maxDiscount);
  return { goods: Math.min(goods, goodsLeft), ship: 0 };
};

const couponLabel = (coupon) => {
  if (coupon.type === "free_delivery") return `Free delivery (${coupon.code})`;
  if (coupon.type === "percent") return `${coupon.value}% off (${coupon.code})`;
  return `${pounds(coupon.value)} off (${coupon.code})`;
};

const couponAdjustment = (coupon, amount) => ({
  kind: "coupon",
  code: coupon.code,
  ref: coupon._id,
  label: couponLabel(coupon),
  info: coupon.description || "",
  amount,
  fundedBy: coupon.fundedBy,
});

/**
 * @param {object} p
 * @param {Array}  p.groups       [{ storeId, store, settings, shippingMethod, method?,
 *                                   items: [{ product, category, unitPrice, quantity }] }]
 * @param {Array}  p.couponCodes  codes attached to the cart, in the order added
 * @param {Array}  p.coupons      Coupon docs found for those codes
 * @param {Array}  p.promotions   live candidate Promotion docs
 * @param {object} p.fees         PlatformSettings.fees
 * @param {object} p.options      { tips, declinedFees } (Map or plain object keyed by storeId)
 * @param {Map}    p.couponUsage  couponId -> this user's live checkouts with it
 * @param {boolean} p.isFirstOrder
 * @param {Date}   [p.now]
 */
const priceCart = ({
  groups,
  couponCodes = [],
  coupons = [],
  promotions = [],
  fees = {},
  options = {},
  couponUsage = new Map(),
  isFirstOrder = true,
  now = new Date(),
}) => {
  const couponByCode = new Map(coupons.map((c) => [String(c.code).toUpperCase(), c]));
  const states = groups.map((g) => {
    const base = priceStoreGroup({
      items: g.items,
      store: g.store,
      settings: g.settings,
      shippingMethod: g.shippingMethod,
      fulfilmentMethod: g.method,
    });
    return {
      g,
      storeKey: String(g.storeId),
      subtotal: base.subtotal,
      shippingFee: base.shippingFee,
      goodsLeft: base.subtotal,
      shipLeft: base.shippingFee,
      adjustments: [],
      nearMisses: [],
      blocking: [],
      optionalFees: [],
      promotion: null,
    };
  });
  const stateByStore = new Map(states.map((s) => [s.storeKey, s]));
  const nudge = (st, kind, amountNeeded, message, extra = {}) =>
    st.nearMisses.push({ kind, storeId: st.g.storeId, amountNeeded, message, blocking: false, ...extra });

  // 1. Automatic promotions: the single best one per store order
  for (const st of states) {
    const candidates = promotions.filter(
      (p) => isLive(p, now) && (p.scope === "platform" || String(p.store) === st.storeKey)
    );
    let best = null;
    let closest = null;
    for (const promo of candidates) {
      const r = evaluatePromotion(promo, st.g.items);
      if (r.amount > 0 && (!best || r.amount > best.amount)) best = { promo, amount: r.amount };
      if (r.gap > 0 && (!closest || r.gap < closest.gap)) closest = { promo, gap: r.gap };
      if (r.unitsNeeded > 0) {
        nudge(st, "promotion", 0, `Add ${r.unitsNeeded} more to unlock ${promo.name}`, {
          code: String(promo._id),
          unitsNeeded: r.unitsNeeded,
        });
      }
    }
    if (best) {
      st.promotion = { id: best.promo._id, name: best.promo.name, amount: best.amount };
      st.adjustments.push({
        kind: "discount",
        code: "offer",
        ref: best.promo._id,
        label: best.promo.name,
        amount: best.amount,
        fundedBy: best.promo.fundedBy,
      });
      st.goodsLeft -= best.amount;
    } else if (closest) {
      nudge(st, "promotion", closest.gap, `Add ${pounds(closest.gap)} more to unlock ${closest.promo.name}`, {
        code: String(closest.promo._id),
      });
    }
  }

  // 2-3. Coupons
  const couponResults = [];
  let platformCoupon = null;
  const storeCoupons = new Map();
  for (const rawCode of couponCodes) {
    const code = String(rawCode).toUpperCase();
    const coupon = couponByCode.get(code);
    const result = {
      code,
      status: "invalid",
      message: "",
      scope: coupon?.scope || null,
      storeId: coupon?.store || null,
      type: coupon?.type || null,
      fundedBy: coupon?.fundedBy || null,
      description: coupon?.description || "",
      discount: 0,
    };
    couponResults.push(result);
    const blocker = couponBlocker(coupon, {
      now,
      usageCount: coupon ? couponUsage.get(String(coupon._id)) || 0 : 0,
      isFirstOrder,
    });
    if (blocker) {
      result.message = blocker;
      continue;
    }

    if (coupon.scope === "platform") {
      if (platformCoupon) {
        result.message = "Only one marketplace code can be used per order";
        continue;
      }
      const cartSubtotal = sumBy(states, (s) => s.subtotal);
      if (cartSubtotal < coupon.minSubtotal) {
        const gap = coupon.minSubtotal - cartSubtotal;
        result.status = "pending";
        result.message = `Spend ${pounds(gap)} more to use ${code}`;
        if (states[0]) nudge(states[0], "coupon", gap, result.message, { code, scope: "platform" });
        continue;
      }
      platformCoupon = { coupon, result };
      continue;
    }

    const st = stateByStore.get(String(coupon.store));
    if (!st) {
      result.status = "pending";
      result.message = "Add items from this code's store to use it";
      continue;
    }
    if (storeCoupons.has(st.storeKey)) {
      result.message = "Only one code per store can be used";
      continue;
    }
    if (st.subtotal < coupon.minSubtotal) {
      const gap = coupon.minSubtotal - st.subtotal;
      result.status = "pending";
      result.message = `Spend ${pounds(gap)} more with this store to use ${code}`;
      nudge(st, "coupon", gap, result.message, { code, scope: "store" });
      continue;
    }
    storeCoupons.set(st.storeKey, { coupon, result });
  }

  for (const st of states) {
    const entry = storeCoupons.get(st.storeKey);
    if (!entry) continue;
    const d = couponDiscountOn(entry.coupon, st);
    st.goodsLeft -= d.goods;
    st.shipLeft -= d.ship;
    entry.result.status = "applied";
    entry.result.message = d.goods + d.ship > 0 ? "" : "Delivery is already free for this order";
    if (d.goods + d.ship > 0) st.adjustments.push(couponAdjustment(entry.coupon, d.goods + d.ship));
  }

  if (platformCoupon) {
    const { coupon, result } = platformCoupon;
    let shares;
    if (coupon.type === "free_delivery") {
      shares = states.map((s) => s.shipLeft);
    } else if (coupon.type === "fixed") {
      const total = Math.min(coupon.value, sumBy(states, (s) => s.goodsLeft));
      shares = allocate(total, states.map((s) => s.goodsLeft));
    } else {
      shares = states.map((s) => percentOf(s.goodsLeft, coupon.value));
      const sum = shares.reduce((a, x) => a + x, 0);
      if (coupon.maxDiscount != null && sum > coupon.maxDiscount) {
        shares = allocate(coupon.maxDiscount, shares);
      }
    }
    states.forEach((st, i) => {
      const amount = Math.min(shares[i], coupon.type === "free_delivery" ? st.shipLeft : st.goodsLeft);
      if (amount <= 0) return;
      if (coupon.type === "free_delivery") st.shipLeft -= amount;
      else st.goodsLeft -= amount;
      st.adjustments.push(couponAdjustment(coupon, amount));
    });
    result.status = "applied";
    result.message = shares.some((x) => x > 0) ? "" : "Delivery is already free for this order";
  }

  // 4-5. Fees, tip, store rules
  const service = fees.service || {};
  const smallOrder = fees.smallOrder || {};
  const bag = fees.bag || {};
  for (const st of states) {
    if (smallOrder.enabled && smallOrder.threshold > 0 && smallOrder.amount > 0) {
      if (st.subtotal < smallOrder.threshold) {
        st.adjustments.push({
          kind: "fee",
          code: "small_order",
          label: smallOrder.label || "Small order fee",
          info: smallOrder.info || "",
          amount: smallOrder.amount,
          fundedBy: "platform",
        });
        const gap = smallOrder.threshold - st.subtotal;
        nudge(st, "small_order_fee", gap, `Add ${pounds(gap)} more to avoid the ${pounds(smallOrder.amount)} small order fee`);
      }
    }
    if (service.enabled && service.percent > 0) {
      let amount = percentOf(st.subtotal, service.percent);
      if (service.min > 0) amount = Math.max(amount, service.min);
      if (service.max > 0) amount = Math.min(amount, service.max);
      if (amount > 0) {
        st.adjustments.push({
          kind: "fee",
          code: "service",
          label: service.label || "Service fee",
          info: service.info || "",
          amount,
          fundedBy: "platform",
        });
      }
    }
    if (bag.enabled && bag.amount > 0) {
      const declined = (mapGet(options.declinedFees, st.storeKey) || []).includes("bag");
      st.optionalFees.push({ code: "bag", label: bag.label || "Carrier bags", amount: bag.amount, removed: declined });
      if (!declined) {
        st.adjustments.push({
          kind: "fee",
          code: "bag",
          label: bag.label || "Carrier bags",
          info: bag.info || "",
          amount: bag.amount,
          fundedBy: "vendor",
          removable: true,
        });
      }
    }

    const tip = Number(mapGet(options.tips, st.storeKey) || 0);
    if (Number.isInteger(tip) && tip > 0) {
      st.adjustments.push({
        kind: "tip",
        code: "tip",
        label: "Tip",
        info: "Paid in full to the store's team",
        amount: tip,
      });
    }

    const threshold = poundsToPence(st.g.settings?.shipping?.freeShippingThreshold);
    if (st.shippingFee > 0 && threshold > 0 && st.subtotal < threshold) {
      const gap = threshold - st.subtotal;
      nudge(st, "free_delivery", gap, `Add ${pounds(gap)} more for free delivery`);
    }

    const minimum = Number(st.g.store?.minimumOrder || 0);
    if (minimum > 0 && st.subtotal < minimum) {
      const gap = minimum - st.subtotal;
      const name = st.g.store?.name || "This store";
      const message = `${name} has a ${pounds(minimum)} minimum order. Add ${pounds(gap)} more`;
      st.blocking.push({ kind: "minimum_order", storeId: st.g.storeId, amountNeeded: gap, message });
      st.nearMisses.unshift({ kind: "minimum_order", storeId: st.g.storeId, amountNeeded: gap, message, blocking: true });
    }
  }

  // Final pricing, and what each coupon actually took off each order
  const out = states.map((st) => {
    const priced = priceStoreGroup({
      items: st.g.items,
      store: st.g.store,
      settings: st.g.settings,
      shippingMethod: st.g.shippingMethod,
      fulfilmentMethod: st.g.method,
      adjustments: st.adjustments,
    });
    const appliedCoupons = priced.lines
      .filter((l) => l.kind === "coupon")
      .map((l) => ({ couponId: l.ref, code: l.code, amount: -l.amount, fundedBy: l.fundedBy }));
    return {
      storeId: st.g.storeId,
      priced,
      appliedCoupons,
      promotion: st.promotion,
      optionalFees: st.optionalFees,
      nearMisses: st.nearMisses,
      blocking: st.blocking,
    };
  });

  for (const result of couponResults) {
    if (result.status !== "applied") continue;
    result.discount = sumBy(out, (g) => sumBy(g.appliedCoupons.filter((c) => c.code === result.code), (c) => c.amount));
  }

  return {
    groups: out,
    coupons: couponResults,
    nearMisses: out.flatMap((g) => g.nearMisses),
    blockingIssues: out.flatMap((g) => g.blocking),
  };
};

/**
 * Load everything priceCart needs for one customer's cart.
 * @param {object} p
 * @param {string} p.userId
 * @param {Array}  p.storeIds
 * @param {Array}  p.productIds
 * @param {Array}  p.couponCodes
 */
const loadOfferContext = async ({ userId, storeIds, productIds, couponCodes = [] }) => {
  /* eslint-disable global-require */
  const Coupon = require("../models/Coupon");
  const CouponUsage = require("../models/CouponUsage");
  const Order = require("../models/Order");
  const PlatformSettings = require("../models/PlatformSettings");
  const Product = require("../models/Product");
  const Promotion = require("../models/Promotion");
  /* eslint-enable global-require */

  const now = new Date();
  const codes = couponCodes.map((c) => String(c).toUpperCase());
  const [coupons, promotions, products, settings, priorOrder] = await Promise.all([
    codes.length ? Coupon.find({ code: { $in: codes } }).lean() : [],
    Promotion.find({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        { $or: [{ scope: "platform" }, { scope: "store", store: { $in: storeIds } }] },
      ],
    }).lean(),
    productIds.length ? Product.find({ _id: { $in: productIds } }).select("category").lean() : [],
    PlatformSettings.getOrInit(),
    userId ? Order.exists({ customer: userId, orderStatus: { $ne: "cancelled" } }) : null,
  ]);
  const usageRows =
    coupons.length && userId
      ? await CouponUsage.find({ user: userId, coupon: { $in: coupons.map((c) => c._id) } }).lean()
      : [];

  return {
    now,
    coupons,
    couponCodes: codes,
    promotions,
    categoryByProduct: new Map(products.map((p) => [String(p._id), p.category || null])),
    fees: settings.toObject().fees || {},
    couponUsage: new Map(usageRows.map((u) => [String(u.coupon), u.count])),
    isFirstOrder: !priorOrder,
  };
};

/**
 * Price a customer's cart groups with everything attached to the cart.
 * Shared by the cart summary (snapshot prices) and checkout (live prices).
 *
 * @param {object} p
 * @param {object} p.cart    Cart doc (couponCodes, tips, declinedFees)
 * @param {string} p.userId
 * @param {Array}  p.groups  [{ storeId, store, settings, shippingMethod, items: [{ product, unitPrice, quantity }] }]
 */
const priceCartWithOffers = async ({ cart, userId, groups }) => {
  const ctx = await loadOfferContext({
    userId,
    storeIds: groups.map((g) => g.storeId),
    productIds: groups.flatMap((g) => g.items.map((i) => i.product)),
    couponCodes: cart?.couponCodes || [],
  });
  const withCategories = groups.map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, category: ctx.categoryByProduct.get(String(i.product)) || null })),
  }));
  return priceCart({
    groups: withCategories,
    couponCodes: ctx.couponCodes,
    coupons: ctx.coupons,
    promotions: ctx.promotions,
    fees: ctx.fees,
    options: { tips: cart?.tips, declinedFees: cart?.declinedFees },
    couponUsage: ctx.couponUsage,
    isFirstOrder: ctx.isFirstOrder,
    now: ctx.now,
  });
};

module.exports = {
  priceCart,
  priceCartWithOffers,
  loadOfferContext,
  couponBlocker,
  evaluatePromotion,
  allocate,
  pounds,
};
