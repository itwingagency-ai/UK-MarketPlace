const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Category = require("../models/Category");
const GlobalCategory = require("../models/GlobalCategory");
const Product = require("../models/Product");
const { slugify, parseBoolean } = require("../validators/category.validator");
const { formatGlobalCategory, orderAsTree } = require("../lib/globalCategories");

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const parseKeywords = (value) => {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((k) => String(k).trim().toLowerCase()).filter(Boolean))]
    .slice(0, 30)
    .map((k) => k.slice(0, 40));
};

/**
 * Validate and normalise an admin payload. Returns only the fields present.
 */
const readPayload = (body, isPatch) => {
  if (!body || typeof body !== "object") throw new ApiError(400, "Invalid category payload");
  const out = {};

  if (!isPatch || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) {
      throw new ApiError(400, "Enter a category name between 2 and 60 characters.");
    }
    out.name = name;
  }

  if (body.slug !== undefined && body.slug !== "") {
    const slug = String(body.slug).trim().toLowerCase();
    if (!SLUG_REGEX.test(slug) || slug.length > 60) {
      throw new ApiError(400, "Slug must be lowercase letters, numbers and single hyphens.");
    }
    out.slug = slug;
  } else if (!isPatch) {
    out.slug = slugify(out.name).slice(0, 60);
  }

  if (body.description !== undefined) {
    const description = String(body.description || "");
    if (description.length > 300) throw new ApiError(400, "Description must be 300 characters or less.");
    out.description = description;
  }

  const iconKey = body.icon3d?.assetKey ?? body.iconKey;
  if (!isPatch || iconKey !== undefined) {
    if (!GlobalCategory.ICON_KEYS.includes(iconKey)) {
      throw new ApiError(400, "Choose a 3D icon for this category.");
    }
    out.icon3d = { assetKey: iconKey };
  }

  if (body.accentColor !== undefined) {
    if (!GlobalCategory.ACCENT_COLORS.includes(body.accentColor)) {
      throw new ApiError(400, "Choose one of the accent colours.");
    }
    out.accentColor = body.accentColor;
  }

  if (body.parent !== undefined) {
    if (body.parent === null || body.parent === "" || body.parent === "null") {
      out.parent = null;
    } else if (!mongoose.Types.ObjectId.isValid(body.parent)) {
      throw new ApiError(400, "Invalid parent category");
    } else {
      out.parent = body.parent;
    }
  }

  if (body.sortOrder !== undefined && body.sortOrder !== "") {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      throw new ApiError(400, "sortOrder must be a whole number from 0 to 9999");
    }
    out.sortOrder = n;
  }

  if (body.isActive !== undefined) out.isActive = parseBoolean(body.isActive);
  if (body.isFeatured !== undefined) out.isFeatured = parseBoolean(body.isFeatured);
  if (body.keywords !== undefined) out.keywords = parseKeywords(body.keywords);

  if (body.seo !== undefined) {
    const title = String(body.seo?.title || "");
    const description = String(body.seo?.description || "");
    if (title.length > 70) throw new ApiError(400, "SEO title must be 70 characters or less.");
    if (description.length > 160) throw new ApiError(400, "SEO description must be 160 characters or less.");
    out.seo = { title, description };
  }

  return out;
};

const ensureSlugFree = async (slug, ignoreId = null) => {
  const filter = { slug };
  if (ignoreId) filter._id = { $ne: ignoreId };
  if (await GlobalCategory.exists(filter)) {
    throw new ApiError(409, "This URL slug is already used by another global category.");
  }
};

// Two levels only: a parent must be a root, and a category that has its own
// children can't be moved under another one.
const checkParent = async (parentId, selfId = null) => {
  if (!parentId) return;
  if (selfId && String(parentId) === String(selfId)) {
    throw new ApiError(400, "A category cannot be its own parent.");
  }
  const parent = await GlobalCategory.findById(parentId).select("parent").lean();
  if (!parent) throw new ApiError(400, "Parent category not found.");
  if (parent.parent) {
    throw new ApiError(400, "Sub-categories can only sit under a top-level category.");
  }
  if (selfId && (await GlobalCategory.exists({ parent: selfId }))) {
    throw new ApiError(400, "This category has sub-categories, so it must stay top-level.");
  }
};

// How many store aisles and products sit under each global category
const loadUsage = async (globalIds) => {
  const storeCats = await Category.find({ globalCategory: { $in: globalIds } })
    .select("_id globalCategory store")
    .lean();
  const productCounts = storeCats.length
    ? await Product.aggregate([
        { $match: { category: { $in: storeCats.map((c) => c._id) } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ])
    : [];
  const productByCat = new Map(productCounts.map((p) => [String(p._id), p.count]));

  const usage = new Map();
  for (const cat of storeCats) {
    const key = String(cat.globalCategory);
    const entry = usage.get(key) || { storeCategoryCount: 0, productCount: 0, stores: new Set() };
    entry.storeCategoryCount += 1;
    entry.productCount += productByCat.get(String(cat._id)) || 0;
    entry.stores.add(String(cat.store));
    usage.set(key, entry);
  }
  return usage;
};

// ── Public ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/categories
 * Active marketplace categories in display order (roots, each followed by
 * its children). `?featured=true` returns only featured top-level ones.
 */
const listPublicGlobalCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.featured === "true") {
    filter.isFeatured = true;
    filter.parent = null;
  }
  const categories = await GlobalCategory.find(filter).lean();

  // A child whose parent is inactive is hidden along with it
  const activeIds = new Set(categories.map((c) => String(c._id)));
  const visible = categories.filter((c) => !c.parent || activeIds.has(String(c.parent)));

  res.status(200).json({ data: orderAsTree(visible).map(formatGlobalCategory) });
});

// ── Admin ───────────────────────────────────────────────────────────────

const listGlobalCategories = asyncHandler(async (req, res) => {
  const categories = await GlobalCategory.find().lean();
  const usage = await loadUsage(categories.map((c) => c._id));

  res.status(200).json({
    data: orderAsTree(categories).map((cat) => {
      const u = usage.get(String(cat._id));
      return {
        ...formatGlobalCategory(cat),
        storeCategoryCount: u?.storeCategoryCount || 0,
        storeCount: u?.stores.size || 0,
        productCount: u?.productCount || 0,
      };
    }),
    meta: {
      iconKeys: GlobalCategory.ICON_KEYS,
      accentColors: GlobalCategory.ACCENT_COLORS,
      unmappedStoreCategories: await Category.countDocuments({ globalCategory: null }),
    },
  });
});

const createGlobalCategory = asyncHandler(async (req, res) => {
  const data = readPayload(req.body, false);
  if (!data.slug || data.slug.length < 2) {
    throw new ApiError(400, "Could not make a URL slug from that name; enter one.");
  }
  await ensureSlugFree(data.slug);
  await checkParent(data.parent);

  if (data.sortOrder === undefined) {
    const last = await GlobalCategory.findOne({ parent: data.parent || null })
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .lean();
    data.sortOrder = last ? (last.sortOrder || 0) + 1 : 0;
  }

  const category = await GlobalCategory.create(data);
  res.status(201).json({ message: "Category created", data: formatGlobalCategory(category) });
});

const updateGlobalCategory = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const category = await GlobalCategory.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found");

  const data = readPayload(req.body, true);
  if (data.slug && data.slug !== category.slug) await ensureSlugFree(data.slug, category._id);
  if (data.parent !== undefined) await checkParent(data.parent, category._id);

  Object.assign(category, data);
  await category.save();
  res.status(200).json({ message: "Category updated", data: formatGlobalCategory(category) });
});

/**
 * PATCH /admin/global-categories/reorder
 * Body: { items: [{ id, parent, sortOrder }] } — the whole new arrangement
 * after a drag, applied in one go.
 */
const reorderGlobalCategories = asyncHandler(async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
    throw new ApiError(400, "items must be a non-empty array");
  }

  const all = await GlobalCategory.find().select("_id parent").lean();
  const known = new Set(all.map((c) => String(c._id)));
  const nextParent = new Map(all.map((c) => [String(c._id), c.parent ? String(c.parent) : null]));

  for (const item of items) {
    if (!known.has(String(item.id))) throw new ApiError(400, `Unknown category ${item.id}`);
    const n = Number(item.sortOrder);
    if (!Number.isInteger(n) || n < 0 || n > 9999) throw new ApiError(400, "Invalid sortOrder");
    if (item.parent !== undefined) {
      const parent = item.parent ? String(item.parent) : null;
      if (parent && !known.has(parent)) throw new ApiError(400, "Unknown parent category");
      if (parent === String(item.id)) throw new ApiError(400, "A category cannot be its own parent.");
      nextParent.set(String(item.id), parent);
    }
  }

  // Check the resulting tree is still two levels deep
  for (const [id, parent] of nextParent) {
    if (!parent) continue;
    if (nextParent.get(parent)) {
      throw new ApiError(400, "Sub-categories can only sit under a top-level category.");
    }
    if ([...nextParent.values()].includes(id)) {
      throw new ApiError(400, "A category with sub-categories must stay top-level.");
    }
  }

  await GlobalCategory.bulkWrite(
    items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: {
          $set: {
            sortOrder: Number(item.sortOrder),
            ...(item.parent !== undefined && { parent: item.parent || null }),
          },
        },
      },
    }))
  );
  res.status(200).json({ message: "Order saved" });
});

/**
 * DELETE /admin/global-categories/:id?replacement=<id>
 * Refuses while sub-categories exist. Store aisles mapped to it are moved to
 * the replacement, which is required when anything is mapped.
 */
const deleteGlobalCategory = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const category = await GlobalCategory.findById(req.params.id);
  if (!category) throw new ApiError(404, "Category not found");

  const childCount = await GlobalCategory.countDocuments({ parent: category._id });
  if (childCount > 0) {
    throw new ApiError(
      409,
      `This category has ${childCount} sub-categor${childCount === 1 ? "y" : "ies"}. Move or delete them first.`
    );
  }

  const usage = (await loadUsage([category._id])).get(String(category._id));
  const replacementId = req.query.replacement || req.body?.replacement;

  if (usage?.storeCategoryCount) {
    if (!replacementId) {
      throw new ApiError(
        409,
        `This category has ${usage.storeCategoryCount} store aisle${usage.storeCategoryCount === 1 ? "" : "s"} and ${usage.productCount} product${usage.productCount === 1 ? "" : "s"} mapped to it. Choose a replacement category before deleting.`
      );
    }
    if (!mongoose.Types.ObjectId.isValid(replacementId) || String(replacementId) === String(category._id)) {
      throw new ApiError(400, "Choose a different replacement category.");
    }
    if (!(await GlobalCategory.exists({ _id: replacementId }))) {
      throw new ApiError(400, "Replacement category not found.");
    }
    await Category.updateMany(
      { globalCategory: category._id },
      { $set: { globalCategory: replacementId } }
    );
  }

  await category.deleteOne();
  res.status(200).json({
    message: usage?.storeCategoryCount
      ? `Category deleted. ${usage.storeCategoryCount} store aisle${usage.storeCategoryCount === 1 ? "" : "s"} moved to the replacement.`
      : "Category deleted",
  });
});

module.exports = {
  listPublicGlobalCategories,
  listGlobalCategories,
  createGlobalCategory,
  updateGlobalCategory,
  reorderGlobalCategories,
  deleteGlobalCategory,
};
