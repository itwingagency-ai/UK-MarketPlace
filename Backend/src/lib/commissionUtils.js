const isNullish = (value) => value === null || value === undefined;

const resolveCommissionConfig = (store, platform) => {
  const platformType = platform?.commission?.type || "percentage";
  const platformRate = Number(platform?.commission?.defaultRate || 0);
  const platformFixed = Number(platform?.commission?.defaultFixed || 0);

  const storeHasType = Boolean(store && store.commissionType);
  const storeHasRate = Boolean(store && !isNullish(store.commissionRate));
  const storeHasFixed = Boolean(store && !isNullish(store.commissionFixed));

  const hasStoreOverride = storeHasType || storeHasRate || storeHasFixed;

  if (!hasStoreOverride) {
    return {
      source: "platform",
      type: platformType,
      rate: platformRate,
      fixed: platformFixed,
    };
  }

  let type = store.commissionType;
  if (!type) {
    if (storeHasRate && !storeHasFixed) type = "percentage";
    else if (storeHasFixed && !storeHasRate) type = "fixed";
    else type = platformType;
  }

  return {
    source: "store",
    type,
    rate: storeHasRate ? Number(store.commissionRate) : platformRate,
    fixed: storeHasFixed ? Number(store.commissionFixed) : platformFixed,
  };
};

const computeCommissionAmount = (config, orderTotal) => {
  const total = Math.max(0, Number(orderTotal || 0));
  if (config.type === "fixed") {
    return Number(Math.min(config.fixed, total).toFixed(2));
  }
  return Number((total * config.rate).toFixed(2));
};

/**
 * What commission is charged on, in pence:
 *
 *   subtotal + shippingFee + Σ vendor-funded price lines (tips excluded)
 *
 * - Vendor-funded reductions (a store's own coupon) lower the base.
 * - Platform-funded reductions do NOT: the platform absorbs them and the vendor
 *   is paid as if the customer had paid full price.
 * - Platform fees (service fee) are platform revenue, not vendor revenue.
 * - Tips pass to the store in full and never carry commission.
 * - Shipping stays in the base: that is how commission was charged before
 *   Wave 0 (on order.total), kept deliberately so no vendor's payout changes.
 *
 * With no price lines this equals subtotal + shippingFee, i.e. order.total.
 */
const computeCommissionBase = ({ subtotal, shippingFee, lines }) => {
  let base = Number(subtotal || 0) + Number(shippingFee || 0);
  for (const line of lines || []) {
    if (line.fundedBy === "vendor" && line.kind !== "tip") base += Number(line.amount || 0);
  }
  return Math.max(0, base);
};

/** Commission base for a stored Order (legacy orders have no priceLines). */
const commissionBaseForOrder = (order) =>
  computeCommissionBase({
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    lines: order.priceLines,
  });

const buildCommissionSnapshot = (config, base) => ({
  type: config.type,
  rate: config.type === "percentage" ? Number(config.rate) : 0,
  fixed: config.type === "fixed" ? Number(config.fixed) : 0,
  base: Math.max(0, Number(base || 0)),
  amount: computeCommissionAmount(config, base),
  calculatedAt: new Date(),
  sourceRate: config.source,
});

/**
 * Commission snapshot for a stored order, including what the store is owed:
 *   vendorNet = commission base + tip - commission
 * (customer total = vendorNet + commission + platform fees - platform discounts)
 */
const buildOrderCommissionSnapshot = (config, order) => {
  const base = commissionBaseForOrder(order);
  const snap = buildCommissionSnapshot(config, base);
  snap.vendorNet = Number((base + Number(order.tipAmount || 0) - snap.amount).toFixed(2));
  return snap;
};

/** What the store is owed for an order (pence); legacy orders: total - commission. */
const vendorNetForOrder = (o) =>
  o.commission?.vendorNet ?? Number(o.total || 0) - Number(o.commission?.amount || 0);

/** Same as vendorNetForOrder, as an aggregation expression. */
const VENDOR_NET_EXPR = {
  $ifNull: [
    "$commission.vendorNet",
    { $subtract: ["$total", { $ifNull: ["$commission.amount", 0] }] },
  ],
};

module.exports = {
  buildOrderCommissionSnapshot,
  vendorNetForOrder,
  VENDOR_NET_EXPR,
  resolveCommissionConfig,
  computeCommissionAmount,
  computeCommissionBase,
  commissionBaseForOrder,
  buildCommissionSnapshot,
};
