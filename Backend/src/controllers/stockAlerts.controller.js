const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Product = require("../models/Product");
const StockAlert = require("../models/StockAlert");

const parseTarget = async (body) => {
  const { productId } = body || {};
  const variantId = body?.variantId || null;
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(400, "Invalid productId");
  if (variantId && !mongoose.Types.ObjectId.isValid(variantId)) throw new ApiError(400, "Invalid variantId");

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, "Product not found");
  if (product.variants.length > 0 && !variantId) {
    throw new ApiError(400, "Choose a size or option to be notified about");
  }
  const variant = variantId ? product.variants.id(variantId) : null;
  if (variantId && !variant) throw new ApiError(404, "That size or option no longer exists");
  return { product, variant, variantId };
};

// GET /customer/stock-alerts?productId=  → the open requests for one product
const listStockAlerts = asyncHandler(async (req, res) => {
  const filter = { user: req.user.id, notifiedAt: null };
  if (req.query.productId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.productId)) throw new ApiError(400, "Invalid productId");
    filter.product = req.query.productId;
  }
  const alerts = await StockAlert.find(filter).select("product variantId createdAt").lean();
  res.status(200).json({ data: alerts });
});

// POST /customer/stock-alerts { productId, variantId? }
const createStockAlert = asyncHandler(async (req, res) => {
  const { product, variant, variantId } = await parseTarget(req.body);
  const inStock = variant ? variant.isActive && variant.stock > 0 : product.stock > 0;
  if (inStock) throw new ApiError(409, "This is in stock now — you can order it straight away");

  await StockAlert.updateOne(
    { user: req.user.id, product: product._id, variantId: variantId || null, notifiedAt: null },
    { $setOnInsert: { store: product.store } },
    { upsert: true }
  );
  res.status(201).json({ message: "We'll let you know when it's back" });
});

// DELETE /customer/stock-alerts { productId, variantId? }
const deleteStockAlert = asyncHandler(async (req, res) => {
  const { productId } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(400, "Invalid productId");
  await StockAlert.deleteOne({
    user: req.user.id,
    product: productId,
    variantId: req.body.variantId || null,
    notifiedAt: null,
  });
  res.status(200).json({ message: "Alert removed" });
});

module.exports = { createStockAlert, deleteStockAlert, listStockAlerts };
