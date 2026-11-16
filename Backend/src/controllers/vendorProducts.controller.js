const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Category = require("../models/Category");
const Product = require("../models/Product");
const {
  MAX_PRODUCT_IMAGES,
  validateProductPayload,
} = require("../validators/product.validator");
const { parseBoolean } = require("../validators/category.validator");
const { deleteFileFromS3 } = require("../lib/s3Utils");
const { getDescendantIds } = require("../lib/categoryTree");
const { checkBackInStock } = require("../lib/stockAlerts");
const {
  LOW_STOCK_THRESHOLD,
  lowStockClause,
  outOfStockClause,
  stockLevelClause,
} = require("../lib/inventory");

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

// Multipart requests carry arrays as JSON strings.
const parseJsonArray = (value, fallback) => {
  if (typeof value !== "string") return value;
  if (!value.trim()) return [];
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback(value);
  }
};

const uploadedUrls = (req) =>
  Array.isArray(req.files) ? req.files.map((f) => f.location).filter(Boolean) : [];

// A request that fails after multer has stored its files would orphan them.
const discardUploads = async (req) => {
  for (const url of uploadedUrls(req)) {
    // eslint-disable-next-line no-await-in-loop
    await deleteFileFromS3(url);
  }
};

const toPriceOrNull = (value) =>
  value === undefined || value === null || value === "" ? null : Number(value);

const hasValue = (value) => value !== undefined && value !== null && value !== "";

/**
 * Build clean variant subdocuments from client input. Variants that carry an
 * existing `_id` keep it (carts reference variants by id) and keep their
 * current stock unless the client explicitly sends a new number.
 */
const normalizeVariants = (incoming, product = null) =>
  incoming.map((v) => {
    const existing =
      product && v._id && mongoose.Types.ObjectId.isValid(v._id)
        ? product.variants.id(v._id)
        : null;
    const next = {
      sku: typeof v.sku === "string" ? v.sku.trim() : existing?.sku || "",
      attributes: v.attributes || (existing ? existing.attributes : {}),
      price: Number(v.price),
      compareAtPrice: toPriceOrNull(v.compareAtPrice),
      stock: hasValue(v.stock) ? Number(v.stock) : existing ? existing.stock : 0,
      images: Array.isArray(v.images) ? v.images : existing?.images || [],
      isActive: v.isActive !== undefined ? parseBoolean(v.isActive) : existing ? existing.isActive : true,
    };
    if (existing) next._id = existing._id;
    return next;
  });

/**
 * Apply incoming variants to a loaded product. When the set of variants is
 * unchanged, edit the subdocuments in place so untouched stock values are
 * never rewritten — an order placed while the form was open keeps its
 * decrement. Adding or removing variants replaces the array.
 */
const applyVariants = (product, incoming) => {
  const next = normalizeVariants(incoming, product);
  const ids = next.filter((v) => v._id).map((v) => String(v._id));
  const sameSet =
    next.length === product.variants.length &&
    ids.length === next.length &&
    new Set(ids).size === ids.length;

  if (!sameSet) {
    product.variants = next;
    return;
  }
  for (const v of next) {
    const sub = product.variants.id(v._id);
    const { _id, ...fields } = v;
    sub.set(fields);
  }
};

const listProducts = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { ...req.storeScopeFilter };
  const and = [];

  if (req.query.category === "none") {
    filter.category = null;
  } else if (req.query.category) {
    if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
      throw new ApiError(400, "Invalid category filter");
    }
    // A parent category lists its subcategories' products too.
    const storeId = req.storeScopeId;
    filter.category =
      req.query.includeSubcategories === "false" || !storeId
        ? req.query.category
        : { $in: await getDescendantIds(storeId, req.query.category) };
  }
  if (req.query.active === "true") filter.isActive = true;
  if (req.query.active === "false") filter.isActive = false;
  if (req.query.search) {
    filter.title = new RegExp(escapeRegex(req.query.search.trim()), "i");
  }
  const stockClause = stockLevelClause(req.query.stock);
  if (stockClause) and.push(stockClause);
  if (and.length > 0) filter.$and = and;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug parent"),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    page,
    limit,
    total,
    data: products,
  });
});

const getStockSummary = asyncHandler(async (req, res) => {
  const base = { ...req.storeScopeFilter };
  const [total, low, out, hidden] = await Promise.all([
    Product.countDocuments(base),
    Product.countDocuments({ ...base, $and: [lowStockClause()] }),
    Product.countDocuments({ ...base, $and: [outOfStockClause()] }),
    Product.countDocuments({ ...base, isActive: false }),
  ]);
  res.status(200).json({
    data: { total, low, out, hidden, lowStockThreshold: LOW_STOCK_THRESHOLD },
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");
  await product.populate("category", "name slug parent");
  res.status(200).json({ data: product });
});

const createProduct = asyncHandler(async (req, res) => {
  try {
    const options = parseJsonArray(req.body.options, () => []);
    const variants = parseJsonArray(req.body.variants, () => []);
    let images = parseJsonArray(req.body.images, (raw) => [raw]);

    // The validator reads these from req.body
    req.body.options = options;
    req.body.variants = variants;
    if (images !== undefined) req.body.images = images;

    validateProductPayload(req.body);

    const targetStoreId = resolveTargetStoreId(req);
    const categoryId = await ensureCategoryInStore(
      req.body.category,
      targetStoreId
    );

    images = [...(Array.isArray(images) ? images : []), ...uploadedUrls(req)];
    if (images.length > MAX_PRODUCT_IMAGES) {
      throw new ApiError(400, `A product can have at most ${MAX_PRODUCT_IMAGES} images`);
    }

    const variantDocs = Array.isArray(variants) ? normalizeVariants(variants) : [];

    const product = await Product.create({
      store: targetStoreId,
      title: req.body.title.trim(),
      description: req.body.description || "",
      size: typeof req.body.size === "string" ? req.body.size.trim() : "",
      // Multipart forms send numbers as strings
      minAge: hasValue(req.body.minAge) ? Number(req.body.minAge) : 0,
      // Variant products get their listing price from the model's pre-validate hook
      price: hasValue(req.body.price) ? Number(req.body.price) : 0,
      compareAtPrice: toPriceOrNull(req.body.compareAtPrice),
      stock: variantDocs.length > 0 || !hasValue(req.body.stock) ? 0 : Number(req.body.stock),
      category: categoryId,
      images,
      options: Array.isArray(options) ? options : [],
      variants: variantDocs,
      isActive:
        req.body.isActive !== undefined ? parseBoolean(req.body.isActive) : true,
    });

    res.status(201).json({
      message: "Product created",
      data: product,
    });
  } catch (err) {
    await discardUploads(req);
    throw err;
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  try {
    const options = parseJsonArray(req.body.options, (raw) => raw);
    const variants = parseJsonArray(req.body.variants, (raw) => raw);
    const images = parseJsonArray(req.body.images, (raw) => [raw]);

    if (options !== undefined) req.body.options = options;
    if (variants !== undefined) req.body.variants = variants;
    if (images !== undefined) req.body.images = images;

    validateProductPayload(req.body, true);

    const product = req.scopedResource;
    if (!product) throw new ApiError(404, "Product not found");

    if (req.body.title !== undefined) {
      product.title = req.body.title.trim();
    }
    if (req.body.description !== undefined) {
      product.description = req.body.description || "";
    }
    if (req.body.size !== undefined) {
      product.size = (req.body.size || "").trim();
    }
    if (req.body.minAge !== undefined) {
      product.minAge = hasValue(req.body.minAge) ? Number(req.body.minAge) : 0;
    }

    // Images: `images` is the list of existing URLs to keep (in display
    // order); newly uploaded files are appended after them.
    const oldImages = Array.isArray(product.images) ? [...product.images] : [];
    const uploads = uploadedUrls(req);
    if (images !== undefined || uploads.length > 0) {
      const kept = images !== undefined ? images : oldImages;
      const nextImages = [...kept, ...uploads];
      if (nextImages.length > MAX_PRODUCT_IMAGES) {
        throw new ApiError(400, `A product can have at most ${MAX_PRODUCT_IMAGES} images`);
      }
      product.images = nextImages;
    }

    if (options !== undefined) product.options = options;
    if (variants !== undefined) applyVariants(product, variants);

    for (const key of ["price", "compareAtPrice", "stock"]) {
      if (req.body[key] === undefined) continue;
      if (key === "compareAtPrice") {
        product.compareAtPrice = toPriceOrNull(req.body.compareAtPrice);
      } else if (hasValue(req.body[key])) {
        product[key] = Number(req.body[key]);
      }
    }

    if (req.body.isActive !== undefined) {
      product.isActive = parseBoolean(req.body.isActive);
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

    // Only remove files from S3 once the new image list is safely saved
    const newImages = Array.isArray(product.images) ? product.images : [];
    for (const img of oldImages.filter((url) => !newImages.includes(url))) {
      // eslint-disable-next-line no-await-in-loop
      await deleteFileFromS3(img);
    }

    await product.populate("category", "name slug parent");
    checkBackInStock(product._id);

    res.status(200).json({
      message: "Product updated",
      data: product,
    });
  } catch (err) {
    await discardUploads(req);
    throw err;
  }
});

/**
 * PATCH /products/:id/stock
 * Body: { stock } to set an absolute count, or { adjust } to add/remove units.
 * Add `variantId` for products with variants. Runs as a single atomic update
 * so it cannot clobber, or be clobbered by, a concurrent order.
 */
const updateStock = asyncHandler(async (req, res) => {
  const product = req.scopedResource;
  if (!product) throw new ApiError(404, "Product not found");

  const hasSet = hasValue(req.body.stock);
  const hasAdjust = hasValue(req.body.adjust);
  if (hasSet === hasAdjust) {
    throw new ApiError(400, "Send either stock (new total) or adjust (change)");
  }
  const value = Number(hasSet ? req.body.stock : req.body.adjust);
  if (!Number.isInteger(value)) {
    throw new ApiError(400, "Stock must be a whole number");
  }
  if (hasSet && value < 0) {
    throw new ApiError(400, "Stock cannot be negative");
  }
  if (Math.abs(value) > 1000000) {
    throw new ApiError(400, "Stock value is too large");
  }

  const { variantId } = req.body;
  const filter = { _id: product._id };
  let path = "stock";

  if (variantId) {
    if (!mongoose.Types.ObjectId.isValid(variantId) || !product.variants.id(variantId)) {
      throw new ApiError(404, "Variant not found on this product");
    }
    path = "variants.$.stock";
    filter.variants = { $elemMatch: { _id: variantId } };
    if (hasAdjust && value < 0) filter.variants.$elemMatch.stock = { $gte: -value };
  } else {
    if (product.variants.length > 0) {
      throw new ApiError(400, "This product has variants; choose which variant to update");
    }
    if (hasAdjust && value < 0) filter.stock = { $gte: -value };
  }

  const update = hasSet ? { $set: { [path]: value } } : { $inc: { [path]: value } };
  const updated = await Product.findOneAndUpdate(filter, update, { returnDocument: "after" })
    .populate("category", "name slug parent");
  if (!updated) {
    throw new ApiError(409, "Not enough stock to remove that many");
  }
  checkBackInStock(updated._id);

  res.status(200).json({ message: "Stock updated", data: updated });
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
  checkBackInStock(product._id);

  res.status(200).json({
    message: "Product restored",
    data: product,
  });
});

module.exports = {
  listProducts,
  getStockSummary,
  getProductById,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  restoreProduct,
};
