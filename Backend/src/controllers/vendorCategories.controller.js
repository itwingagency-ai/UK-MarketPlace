const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Category = require("../models/Category");
const GlobalCategory = require("../models/GlobalCategory");
const Product = require("../models/Product");
const {
  parseBoolean,
  slugify,
  validateCategoryPayload,
} = require("../validators/category.validator");
const { deleteFileFromS3 } = require("../lib/s3Utils");
const { compareCategories } = require("../lib/categoryTree");

const ensureUniqueSlug = async (storeId, baseSlug, ignoreId = null) => {
  let candidate = baseSlug;
  let suffix = 1;

  while (suffix <= 100) {
    const filter = { store: storeId, slug: candidate };
    if (ignoreId) filter._id = { $ne: ignoreId };
    // eslint-disable-next-line no-await-in-loop
    const exists = await Category.findOne(filter);
    if (!exists) return candidate;

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  throw new ApiError(409, "Could not generate a unique category slug");
};

const MISSING_MAPPING =
  "Select which marketplace category this aisle belongs to so customers can discover your products.";

// Returns the global category id, or null when the field is empty
const resolveGlobalCategory = async (value) => {
  if (value === undefined || value === null || value === "" || value === "null") return null;
  if (!mongoose.Types.ObjectId.isValid(value)) throw new ApiError(400, MISSING_MAPPING);
  const global = await GlobalCategory.findOne({ _id: value, isActive: true }).select("_id").lean();
  if (!global) throw new ApiError(400, "That marketplace category is no longer available.");
  return global._id;
};

const findOwnedCategory = async (id, storeId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Category.findOne({ _id: id, store: storeId });
};

const listCategories = asyncHandler(async (req, res) => {
  const filter = { ...req.storeScopeFilter };
  if (req.query.active === "true") filter.isActive = true;
  if (req.query.active === "false") filter.isActive = false;

  if (req.query.parent === "root") {
    filter.parent = null;
  } else if (req.query.parent && req.query.parent !== "any") {
    if (!mongoose.Types.ObjectId.isValid(req.query.parent)) {
      throw new ApiError(400, "Invalid parent id");
    }
    filter.parent = req.query.parent;
  }

  if (req.query.search) {
    const escaped = String(req.query.search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = new RegExp(escaped, "i");
  }

  const categories = (
    await Category.find(filter)
      .populate("globalCategory", "name slug icon3d accentColor isActive")
      .lean()
  ).sort(compareCategories);

  // Direct product counts so the dashboard can show what each category holds
  // and warn before a delete that would be refused.
  const counts = categories.length
    ? await Product.aggregate([
        { $match: { category: { $in: categories.map((c) => c._id) } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  res.status(200).json({
    data: categories.map((c) => ({
      ...c,
      productCount: countMap.get(String(c._id)) || 0,
    })),
  });
});

const getCategoryById = asyncHandler(async (req, res) => {
  const category = req.scopedResource;
  if (!category) throw new ApiError(404, "Category not found");
  res.status(200).json({ data: category });
});

const createCategory = asyncHandler(async (req, res) => {
  validateCategoryPayload(req.body);
  const storeId = resolveTargetStoreId(req);

  const baseSlug = slugify(req.body.slug || req.body.name);
  if (!baseSlug || baseSlug.length < 2) {
    throw new ApiError(400, "Could not derive a valid slug from name/slug");
  }

  let parentId = null;
  let parent = null;
  if (req.body.parent && req.body.parent !== "null" && req.body.parent !== "") {
    parent = await findOwnedCategory(req.body.parent, storeId);
    if (!parent) {
      throw new ApiError(400, "Parent category does not belong to your store");
    }
    parentId = parent._id;
  }

  // Every aisle maps to a marketplace category; a sub-aisle may inherit its parent's
  const globalCategory =
    (await resolveGlobalCategory(req.body.globalCategory)) || parent?.globalCategory || null;
  if (!globalCategory) throw new ApiError(400, MISSING_MAPPING);

  const slug = await ensureUniqueSlug(storeId, baseSlug);

  let image = req.body.image || "";
  if (req.file && req.file.location) {
    image = req.file.location;
  }

  const category = await Category.create({
    store: storeId,
    name: req.body.name.trim(),
    slug,
    parent: parentId,
    globalCategory,
    description: req.body.description || "",
    image,
    isActive:
      req.body.isActive !== undefined ? parseBoolean(req.body.isActive) : true,
    sortOrder:
      req.body.sortOrder !== undefined && req.body.sortOrder !== ""
        ? Number(req.body.sortOrder)
        : 0,
  });

  res.status(201).json({ message: "Category created", data: category });
});

const updateCategory = asyncHandler(async (req, res) => {
  validateCategoryPayload(req.body, true);

  const category = req.scopedResource;
  if (!category) throw new ApiError(404, "Category not found");

  if (req.body.name !== undefined) {
    category.name = req.body.name.trim();
  }

  if (req.body.slug !== undefined && req.body.slug) {
    const desired = slugify(req.body.slug);
    if (!desired) throw new ApiError(400, "Could not derive a valid slug");
    if (desired !== category.slug) {
      category.slug = await ensureUniqueSlug(
        category.store,
        desired,
        category._id
      );
    }
  }

  if (req.body.parent !== undefined) {
    if (req.body.parent === null || req.body.parent === "" || req.body.parent === "null") {
      category.parent = null;
    } else {
      if (String(req.body.parent) === String(category._id)) {
        throw new ApiError(400, "A category cannot be its own parent");
      }
      const parent = await findOwnedCategory(req.body.parent, category.store);
      if (!parent) {
        throw new ApiError(
          400,
          "Parent category does not belong to your store"
        );
      }

      let cursor = parent;
      const visited = new Set();
      while (cursor) {
        if (String(cursor._id) === String(category._id)) {
          throw new ApiError(400, "Parent assignment would create a cycle");
        }
        if (visited.has(String(cursor._id))) break;
        visited.add(String(cursor._id));
        // eslint-disable-next-line no-await-in-loop
        cursor = cursor.parent ? await Category.findById(cursor.parent) : null;
      }

      category.parent = parent._id;
    }
  }

  if (req.body.globalCategory !== undefined) {
    const globalCategory = await resolveGlobalCategory(req.body.globalCategory);
    if (!globalCategory) throw new ApiError(400, MISSING_MAPPING);
    category.globalCategory = globalCategory;
  }

  if (req.body.description !== undefined) {
    category.description = req.body.description || "";
  }
  if (req.file && req.file.location) {
    if (category.image && category.image !== req.file.location) {
      await deleteFileFromS3(category.image);
    }
    category.image = req.file.location;
  } else if (req.body.image !== undefined) {
    category.image = req.body.image || "";
  }
  if (req.body.isActive !== undefined) {
    category.isActive = parseBoolean(req.body.isActive);
  }
  if (req.body.sortOrder !== undefined && req.body.sortOrder !== "") {
    category.sortOrder = Number(req.body.sortOrder);
  }

  await category.save();
  res.status(200).json({ message: "Category updated", data: category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = req.scopedResource;
  if (!category) throw new ApiError(404, "Category not found");

  const childCount = await Category.countDocuments({ parent: category._id });
  if (childCount > 0) {
    throw new ApiError(
      409,
      `This category has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Move or delete them first.`
    );
  }

  const productCount = await Product.countDocuments({
    category: category._id,
  });
  if (productCount > 0) {
    throw new ApiError(
      409,
      `This category still has ${productCount} product${productCount === 1 ? "" : "s"}. Move them to another category first, or hide the category instead.`
    );
  }

  if (category.image) {
    await deleteFileFromS3(category.image);
  }
  await category.deleteOne();
  res.status(200).json({ message: "Category deleted" });
});

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
