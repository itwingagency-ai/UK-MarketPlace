const ApiError = require("./ApiError");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Store = require("../models/Store");
const StoreSettings = require("../models/StoreSettings");
const {
  buildMethodSnapshot,
  computeShippingFeeForStore,
  findActiveShippingMethodsByStores,
} = require("./shippingUtils");
const { priceCartWithOffers } = require("./offers");
const { STORE_FULFILMENT_FIELDS, choiceFor, resolveFulfilment } = require("./fulfilment");

const getOrCreateCart = async (userId) => {
  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return cart;
};

const findCartItem = (cart, productId, variantId) => {
  const variantKey = String(variantId || "");
  return cart.items.find(
    (item) =>
      String(item.product) === String(productId) &&
      String(item.variantId || "") === variantKey
  );
};

const findCartItemIndex = (cart, productId, variantId) => {
  const variantKey = String(variantId || "");
  return cart.items.findIndex(
    (item) =>
      String(item.product) === String(productId) &&
      String(item.variantId || "") === variantKey
  );
};

const getProductImage = (product, variant) => {
  if (variant && Array.isArray(variant.images) && variant.images.length > 0) {
    return variant.images[0];
  }
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }
  return "";
};

const variantAttributesToObject = (variant) => {
  if (!variant) return {};
  if (variant.attributes instanceof Map) {
    return Object.fromEntries(variant.attributes);
  }
  if (variant.attributes && typeof variant.attributes === "object") {
    return { ...variant.attributes };
  }
  return {};
};

const resolveProductForCart = async ({ productId, variantId }) => {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    throw new ApiError(400, "Product is not available");
  }

  if (!variantId && product.variants && product.variants.length > 0) {
    throw new ApiError(
      400,
      "This product requires a variant selection (variantId)"
    );
  }

  let variant = null;
  if (variantId) {
    variant = product.variants.id(variantId);
    if (!variant || !variant.isActive) {
      throw new ApiError(400, "Selected variant is not available");
    }
  }

  return {
    product,
    variant,
    unitPrice: variant ? Number(variant.price) : Number(product.price),
    compareAtPrice: variant ? (variant.compareAtPrice ? Number(variant.compareAtPrice) : null) : (product.compareAtPrice ? Number(product.compareAtPrice) : null),
    availableStock: variant ? Number(variant.stock) : Number(product.stock),
    title: product.title,
    minAge: Number(product.minAge || 0),
    sku: variant ? variant.sku || "" : "",
    attributes: variantAttributesToObject(variant),
    image: getProductImage(product, variant),
    storeId: product.store,
  };
};

const buildLiveSnapshotForItem = async (item) => {
  const product = await Product.findById(item.product);

  if (!product || !product.isActive) {
    return {
      available: false,
      reason: "Product is no longer available",
      live: null,
    };
  }

  let variant = null;
  if (item.variantId) {
    variant = product.variants.id(item.variantId);
    if (!variant || !variant.isActive) {
      return {
        available: false,
        reason: "Selected variant is no longer available",
        live: null,
      };
    }
  } else if (product.variants && product.variants.length > 0) {
    return {
      available: false,
      reason: "This product now requires a variant selection",
      live: null,
    };
  }

  const livePrice = variant ? Number(variant.price) : Number(product.price);
  const liveStock = variant ? Number(variant.stock) : Number(product.stock);

  if (liveStock < item.quantity) {
    return {
      available: false,
      reason:
        liveStock <= 0
          ? "Out of stock"
          : `Only ${liveStock} in stock (you have ${item.quantity} in cart)`,
      live: { unitPrice: livePrice, stock: liveStock, title: product.title },
    };
  }

  return {
    available: true,
    reason: null,
    live: {
      unitPrice: livePrice,
      stock: liveStock,
      title: product.title,
      minAge: Number(product.minAge || 0),
      priceChanged: livePrice !== Number(item.unitPrice),
    },
  };
};

// Backwards-compatible signature: existing callers pass (settings, subtotal).
// The new optional `method` argument enables method-aware fee resolution.
const computeStoreShippingFee = (settings, subtotal, method = null) =>
  computeShippingFeeForStore({ method, settings, subtotal });

const mapToObject = (m) => {
  if (!m) return {};
  if (m instanceof Map) return Object.fromEntries(m);
  return { ...m };
};

const buildCartSummary = async (cart) => {
  const byStoreMap = new Map();

  for (const item of cart.items) {
    const storeKey = String(item.store);
    if (!byStoreMap.has(storeKey)) {
      byStoreMap.set(storeKey, {
        storeId: item.store,
        items: [],
        itemCount: 0,
        subtotal: 0,
        shippingFee: 0,
        total: 0,
      });
    }
    const group = byStoreMap.get(storeKey);
    const lineTotal = Number(item.unitPrice) * Number(item.quantity);
    group.items.push({
      _id: item._id,
      product: item.product,
      variantId: item.variantId,
      title: item.title,
      sku: item.sku,
      attributes: item.attributes,
      image: item.image,
      unitPrice: item.unitPrice,
      compareAtPrice: item.compareAtPrice,
      quantity: item.quantity,
      minAge: item.minAge || 0,
      lineTotal,
    });
    group.itemCount += Number(item.quantity);
  }

  const storeIds = Array.from(byStoreMap.keys());
  const [settingsList, methodsByStore, storesList] = await Promise.all([
    storeIds.length
      ? StoreSettings.find({ store: { $in: storeIds } })
      : Promise.resolve([]),
    findActiveShippingMethodsByStores(storeIds),
    storeIds.length
      ? Store.find({ _id: { $in: storeIds } }).select(`slug location locationSet deliveryRadiusKm minimumOrder loyaltyOptIn ${STORE_FULFILMENT_FIELDS}`)
      : Promise.resolve([]),
  ]);
  const settingsByStore = new Map(
    settingsList.map((s) => [String(s.store), s])
  );
  const storesById = new Map(
    storesList.map((s) => [String(s._id), s])
  );

  const groups = Array.from(byStoreMap.values());
  const fulfilments = await Promise.all(
    groups.map((group) =>
      resolveFulfilment({ store: storesById.get(String(group.storeId)), choice: choiceFor(cart, group.storeId) })
    )
  );
  const pricingInputs = groups.map((group, i) => {
    const storeKey = String(group.storeId);
    const methods = methodsByStore.get(storeKey) || [];
    const storeObj = storesById.get(storeKey);
    group.storeName = storeObj?.name || "";
    group.storeSlug = storeObj?.slug || "";
    group.location = storeObj?.location || null;
    group.locationSet = storeObj?.locationSet || false;
    group.deliveryRadiusKm = storeObj?.deliveryRadiusKm || 5;
    group.minimumOrder = storeObj?.minimumOrder || 0;
    group.availableShippingMethods = methods.map(buildMethodSnapshot);
    group.defaultShippingMethod = buildMethodSnapshot(methods[0] || null);
    group.fulfilment = fulfilments[i];
    const collecting = fulfilments[i].method === "collection";
    // The cart prices from its snapshot unit prices; checkout re-prices live.
    return {
      storeId: group.storeId,
      store: storeObj,
      settings: settingsByStore.get(storeKey),
      shippingMethod: collecting ? null : methods[0] || null,
      method: fulfilments[i].method,
      items: group.items.map((i) => ({ product: i.product, unitPrice: i.unitPrice, quantity: i.quantity })),
    };
  });

  const result = await priceCartWithOffers({ cart, userId: cart.user, groups: pricingInputs });
  const tips = mapToObject(cart.tips);
  const notes = mapToObject(cart.notes);

  let grandSubtotal = 0;
  let grandShipping = 0;
  let grandTotal = 0;
  let discountTotal = 0;
  let feeTotal = 0;
  let tipTotal = 0;
  let totalItems = 0;

  groups.forEach((group, i) => {
    const priced = result.groups[i].priced;
    group.subtotal = priced.subtotal;
    group.shippingFee = priced.shippingFee;
    group.lines = priced.lines;
    group.discountTotal = priced.discountTotal;
    group.feeTotal = priced.feeTotal;
    group.tipAmount = priced.tipAmount;
    group.total = priced.total;
    group.promotion = result.groups[i].promotion;
    group.optionalFees = result.groups[i].optionalFees;
    group.loyaltyOptIn = Boolean(storesById.get(String(group.storeId))?.loyaltyOptIn);
    group.loyaltyPoints = result.groups[i].loyaltyPoints;
    group.nearMisses = result.groups[i].nearMisses;
    group.note = notes[String(group.storeId)] || "";

    grandSubtotal += group.subtotal;
    grandShipping += group.shippingFee;
    grandTotal += group.total;
    discountTotal += group.discountTotal;
    feeTotal += group.feeTotal;
    tipTotal += group.tipAmount;
    totalItems += group.itemCount;
  });

  return {
    cartId: cart._id,
    totalItems,
    byStore: groups,
    subtotal: grandSubtotal,
    shippingFee: grandShipping,
    discountTotal,
    feeTotal,
    tipTotal,
    grandTotal,
    coupons: result.coupons,
    loyalty: result.loyalty,
    // Highest age restriction in the basket: checkout asks the customer to confirm it
    ageCheck: Math.max(0, ...cart.items.map((i) => Number(i.minAge || 0))),
    nearMisses: result.nearMisses,
    blockingIssues: [
      ...result.blockingIssues,
      ...groups
        .filter((g) => g.fulfilment.issue)
        .map((g) => ({ kind: "fulfilment", storeId: g.storeId, message: g.fulfilment.issue })),
    ],
    options: {
      allowSubstitutions: cart.allowSubstitutions !== false,
      tips,
      notes,
    },
    updatedAt: cart.updatedAt,
  };
};

module.exports = {
  getOrCreateCart,
  findCartItem,
  findCartItemIndex,
  resolveProductForCart,
  buildLiveSnapshotForItem,
  computeStoreShippingFee,
  buildCartSummary,
  variantAttributesToObject,
  mapToObject,
};
