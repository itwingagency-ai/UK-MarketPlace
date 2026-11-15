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

module.exports = {
  resolveCommissionConfig,
  computeCommissionAmount,
  computeCommissionBase,
  commissionBaseForOrder,
  buildCommissionSnapshot,
};
