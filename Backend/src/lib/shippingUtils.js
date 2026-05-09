const ShippingMethod = require("../models/ShippingMethod");

const findActiveShippingMethodsByStores = async (storeIds) => {
  const byStore = new Map();
  if (!storeIds || storeIds.length === 0) return byStore;

  const methods = await ShippingMethod.find({
    store: { $in: storeIds },
    isActive: true,
  }).sort({ sortOrder: 1, fee: 1, createdAt: 1 });

  for (const method of methods) {
    const key = String(method.store);
    if (!byStore.has(key)) byStore.set(key, []);
    byStore.get(key).push(method);
  }
  return byStore;
};

const computeShippingFeeForStore = ({ method, settings, subtotal }) => {
  const threshold = Number(settings?.shipping?.freeShippingThreshold || 0);
  if (threshold > 0 && subtotal >= threshold) return 0;

  if (method) return Number(method.fee || 0);

  // Backwards-compatible fallback for stores that haven't configured methods yet
  return Number(settings?.shipping?.flatFee || 0);
};

const buildMethodSnapshot = (method) => {
  if (!method) return null;
  return {
    id: method._id,
    code: method.code,
    name: method.name,
    description: method.description || "",
    fee: Number(method.fee || 0),
    minDays: Number(method.minDays || 0),
    maxDays: Number(method.maxDays || 0),
  };
};

const computeEstimatedDelivery = (method, fromDate = new Date()) => {
  if (!method || (!method.minDays && !method.maxDays)) {
    return { earliest: null, latest: null };
  }
  const min = Number(method.minDays || 0);
  const max = Number(method.maxDays || min);
  const earliest = new Date(fromDate.getTime() + min * 24 * 60 * 60 * 1000);
  const latest = new Date(fromDate.getTime() + max * 24 * 60 * 60 * 1000);
  return { earliest, latest };
};

module.exports = {
  findActiveShippingMethodsByStores,
  computeShippingFeeForStore,
  buildMethodSnapshot,
  computeEstimatedDelivery,
};
