const ApiError = require("./ApiError");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const StoreSettings = require("../models/StoreSettings");
const {
  buildMethodSnapshot,
  computeShippingFeeForStore,
  findActiveShippingMethodsByStores,
} = require("./shippingUtils");

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
    availableStock: variant ? Number(variant.stock) : Number(product.stock),
    title: product.title,
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
      priceChanged: livePrice !== Number(item.unitPrice),
    },
  };
};

// Backwards-compatible signature: existing callers pass (settings, subtotal).
// The new optional `method` argument enables method-aware fee resolution.
const computeStoreShippingFee = (settings, subtotal, method = null) =>
  computeShippingFeeForStore({ method, settings, subtotal });

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
      quantity: item.quantity,
      lineTotal,
    });
    group.itemCount += Number(item.quantity);
    group.subtotal += lineTotal;
  }

  const storeIds = Array.from(byStoreMap.keys());
  const [settingsList, methodsByStore] = await Promise.all([
    storeIds.length
      ? StoreSettings.find({ store: { $in: storeIds } })
      : Promise.resolve([]),
    findActiveShippingMethodsByStores(storeIds),
  ]);
  const settingsByStore = new Map(
    settingsList.map((s) => [String(s.store), s])
  );

  let grandSubtotal = 0;
  let grandShipping = 0;
  let totalItems = 0;

  for (const group of byStoreMap.values()) {
    const storeKey = String(group.storeId);
    const settings = settingsByStore.get(storeKey);
    const methods = methodsByStore.get(storeKey) || [];
    const defaultMethod = methods[0] || null;

    group.shippingFee = computeShippingFeeForStore({
      method: defaultMethod,
      settings,
      subtotal: group.subtotal,
    });
    group.total = group.subtotal + group.shippingFee;
    group.availableShippingMethods = methods.map(buildMethodSnapshot);
    group.defaultShippingMethod = buildMethodSnapshot(defaultMethod);

    grandSubtotal += group.subtotal;
    grandShipping += group.shippingFee;
    totalItems += group.itemCount;
  }

  return {
    cartId: cart._id,
    totalItems,
    byStore: Array.from(byStoreMap.values()),
    subtotal: grandSubtotal,
    shippingFee: grandShipping,
    grandTotal: grandSubtotal + grandShipping,
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
};
