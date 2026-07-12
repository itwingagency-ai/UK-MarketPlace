const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { validateProductPayload } = require("../validators/product.validator");
const { deleteFileFromS3 } = require("../lib/s3Utils");

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

const listProducts = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

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

  res.status(200).json({
    page,
    limit,
    total,
    data: products,
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");
  await product.populate("category", "name slug");
  res.status(200).json({ data: product });
});

const createProduct = asyncHandler(async (req, res) => {
  let options = req.body.options;
  if (typeof options === "string") {
    if (!options.trim()) options = [];
    else try { options = JSON.parse(options); } catch (e) { options = []; }
  }
  let variants = req.body.variants;
  if (typeof variants === "string") {
    if (!variants.trim()) variants = [];
    else try { variants = JSON.parse(variants); } catch (e) { variants = []; }
  }

  // To ensure validator passes since it modifies req.body in place
  req.body.options = options;
  req.body.variants = variants;

  validateProductPayload(req.body);

  const targetStoreId = resolveTargetStoreId(req);
  const categoryId = await ensureCategoryInStore(
    req.body.category,
    targetStoreId
  );

  let images = Array.isArray(req.body.images) ? req.body.images : [];
  if (typeof req.body.images === "string") {
    try { images = JSON.parse(req.body.images); } catch (e) { images = [req.body.images]; }
  }
  
  if (req.files && Array.isArray(req.files)) {
    const uploadedUrls = req.files.map((f) => f.location).filter(Boolean);
    images = [...images, ...uploadedUrls];
  }

  const product = await Product.create({
    store: targetStoreId,
    title: req.body.title.trim(),
    description: req.body.description || "",
    price: Number(req.body.price),
    compareAtPrice:
      req.body.compareAtPrice === undefined || req.body.compareAtPrice === null
        ? null
        : Number(req.body.compareAtPrice),
    stock: Number(req.body.stock),
    category: categoryId,
    images,
    options: Array.isArray(options) ? options : [],
    variants: Array.isArray(variants) ? variants : [],
    isActive:
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
  });

  res.status(201).json({
    message: "Product created",
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  let options = req.body.options;
  if (typeof options === "string") {
    if (!options.trim()) options = [];
    else try { options = JSON.parse(options); } catch (e) { }
  }
  let variants = req.body.variants;
  if (typeof variants === "string") {
    if (!variants.trim()) variants = [];
    else try { variants = JSON.parse(variants); } catch (e) { }
  }
  let images = req.body.images;
  if (typeof images === "string") {
    if (!images.trim()) images = [];
    else try { images = JSON.parse(images); } catch (e) { images = [images]; }
  }

  if (options !== undefined) req.body.options = options;
  if (variants !== undefined) req.body.variants = variants;
  if (images !== undefined) req.body.images = images;

  validateProductPayload(req.body, true);

  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

  const directFields = ["description", "images", "options", "variants"];
  const numericFields = ["price", "compareAtPrice", "stock"];

  if (req.body.title !== undefined) {
    product.title = req.body.title.trim();
  }

  const oldImages = Array.isArray(product.images) ? [...product.images] : [];

  for (const key of directFields) {
    if (req.body[key] !== undefined) {
      product[key] = req.body[key];
    }
  }

  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const uploadedUrls = req.files.map((f) => f.location).filter(Boolean);
    product.images = uploadedUrls;
  }

  // Delete removed images from S3
  const newImages = Array.isArray(product.images) ? product.images : [];
  const removedImages = oldImages.filter(img => !newImages.includes(img));
  for (const img of removedImages) {
    await deleteFileFromS3(img);
  }

  for (const key of numericFields) {
    if (req.body[key] === undefined) continue;
    product[key] = (req.body[key] === null || req.body[key] === "") ? null : Number(req.body[key]);
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
    }
  }

  await product.save();
  await product.populate("category", "name slug");

  res.status(200).json({
    message: "Product updated",
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

  if (req.query.hard === "true") {
    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        await deleteFileFromS3(img);
      }
    }
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
  });
});

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
};
