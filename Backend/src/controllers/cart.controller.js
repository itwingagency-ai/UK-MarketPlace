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

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
