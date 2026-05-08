const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Product = require("../models/Product");
const { validateProductPayload } = require("../validators/product.validator");

const listProducts = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const products = await Product.find({ ...req.storeScopeFilter })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const total = await Product.countDocuments({ ...req.storeScopeFilter });

  res.status(200).json({
    page,
    limit,
    total,
    data: products,
  });
});

const createProduct = asyncHandler(async (req, res) => {
  validateProductPayload(req.body);

  const targetStoreId = resolveTargetStoreId(req);
  const product = await Product.create({
    store: targetStoreId,
    title: req.body.title.trim(),
    description: req.body.description || "",
    price: Number(req.body.price),
    compareAtPrice:
      req.body.compareAtPrice === undefined ? null : Number(req.body.compareAtPrice),
    stock: Number(req.body.stock),
    category: req.body.category || "general",
    images: req.body.images || [],
    isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
  });

  res.status(201).json({
    message: "Product created",
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  validateProductPayload(req.body, true);

  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

  const allowedFields = [
    "title",
    "description",
    "price",
    "compareAtPrice",
    "stock",
    "category",
    "images",
    "isActive",
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      if (key === "title") product[key] = req.body[key].trim();
      else if (["price", "compareAtPrice", "stock"].includes(key) && req.body[key] !== null) {
        product[key] = Number(req.body[key]);
      } else {
        product[key] = req.body[key];
      }
    }
  }

  await product.save();

  res.status(200).json({
    message: "Product updated",
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

  product.isActive = false;
  await product.save();

  res.status(200).json({
    message: "Product archived",
  });
});

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
