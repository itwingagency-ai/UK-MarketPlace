<<<<<<< HEAD
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Product = require("../models/Product");
const { validateProductPayload } = require("../validators/product.validator");

=======
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { validateProductPayload } = require("../validators/product.validator");

const ensureCategoryInStore = async (categoryId, storeId) => {
  if (!categoryId) return null;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category id");
  }
  const category = await Category.findOne({
    _id: categoryId,
    store: storeId,
  });
  if (!category) {
    throw new ApiError(400, "Category does not belong to your store");
  }
  return category._id;
};

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
const listProducts = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

<<<<<<< HEAD
  const products = await Product.find({ ...req.storeScopeFilter })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const total = await Product.countDocuments({ ...req.storeScopeFilter });
=======
  const filter = { ...req.storeScopeFilter };

  if (req.query.category) {
    if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
      throw new ApiError(400, "Invalid category filter");
    }
    filter.category = req.query.category;
  }
  if (req.query.active === "true") filter.isActive = true;
  if (req.query.active === "false") filter.isActive = false;
  if (req.query.search) {
    filter.title = new RegExp(escapeRegex(req.query.search.trim()), "i");
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug"),
    Product.countDocuments(filter),
  ]);
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81

  res.status(200).json({
    page,
    limit,
    total,
    data: products,
  });
});

<<<<<<< HEAD
=======
const getProductById = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");
  await product.populate("category", "name slug");
  res.status(200).json({ data: product });
});

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
const createProduct = asyncHandler(async (req, res) => {
  validateProductPayload(req.body);

  const targetStoreId = resolveTargetStoreId(req);
<<<<<<< HEAD
=======
  const categoryId = await ensureCategoryInStore(
    req.body.category,
    targetStoreId
  );

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
  const product = await Product.create({
    store: targetStoreId,
    title: req.body.title.trim(),
    description: req.body.description || "",
    price: Number(req.body.price),
    compareAtPrice:
<<<<<<< HEAD
      req.body.compareAtPrice === undefined ? null : Number(req.body.compareAtPrice),
    stock: Number(req.body.stock),
    category: req.body.category || "general",
    images: req.body.images || [],
    isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
=======
      req.body.compareAtPrice === undefined || req.body.compareAtPrice === null
        ? null
        : Number(req.body.compareAtPrice),
    stock: Number(req.body.stock),
    category: categoryId,
    images: Array.isArray(req.body.images) ? req.body.images : [],
    options: Array.isArray(req.body.options) ? req.body.options : [],
    variants: Array.isArray(req.body.variants) ? req.body.variants : [],
    isActive:
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
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

<<<<<<< HEAD
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
=======
  const directFields = ["description", "images", "options", "variants"];
  const numericFields = ["price", "compareAtPrice", "stock"];

  if (req.body.title !== undefined) {
    product.title = req.body.title.trim();
  }

  for (const key of directFields) {
    if (req.body[key] !== undefined) {
      product[key] = req.body[key];
    }
  }

  for (const key of numericFields) {
    if (req.body[key] === undefined) continue;
    product[key] = req.body[key] === null ? null : Number(req.body[key]);
  }

  if (req.body.isActive !== undefined) {
    product.isActive = Boolean(req.body.isActive);
  }

  if (req.body.category !== undefined) {
    if (req.body.category === null || req.body.category === "") {
      product.category = null;
    } else {
      product.category = await ensureCategoryInStore(
        req.body.category,
        product.store
      );
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
    }
  }

  await product.save();
<<<<<<< HEAD
=======
  await product.populate("category", "name slug");
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81

  res.status(200).json({
    message: "Product updated",
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

<<<<<<< HEAD
  product.isActive = false;
  await product.save();

  res.status(200).json({
    message: "Product archived",
=======
  if (req.query.hard === "true") {
    await product.deleteOne();
    return res.status(200).json({ message: "Product deleted permanently" });
  }

  product.isActive = false;
  await product.save();
  return res.status(200).json({ message: "Product archived" });
});

const restoreProduct = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

  product.isActive = true;
  await product.save();

  res.status(200).json({
    message: "Product restored",
    data: product,
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
  });
});

module.exports = {
  listProducts,
<<<<<<< HEAD
  createProduct,
  updateProduct,
  deleteProduct,
=======
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
};
