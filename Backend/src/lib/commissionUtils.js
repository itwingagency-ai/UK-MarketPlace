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

const buildCommissionSnapshot = (config, orderTotal) => ({
  type: config.type,
  rate: config.type === "percentage" ? Number(config.rate) : 0,
  fixed: config.type === "fixed" ? Number(config.fixed) : 0,
  amount: computeCommissionAmount(config, orderTotal),
  calculatedAt: new Date(),
  sourceRate: config.source,
});

module.exports = {
  resolveCommissionConfig,
  computeCommissionAmount,
  buildCommissionSnapshot,
};
