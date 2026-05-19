/**
 * productSearch.controller.js
 *
 * Public (unauthenticated) product search endpoints.
 *
 * Three search modes:
 *   1. Full-text search  — uses MongoDB $text index (title + description weighted)
 *   2. Browse / filter   — no query, just filters (category, price range, store)
 *   3. Autocomplete      — lightweight prefix search for search-as-you-type
 *
 * Endpoints:
 *   GET /api/v1/products/search      — full search with filters + pagination
 *   GET /api/v1/products/suggest     — autocomplete suggestions (fast, max 8 results)
 *   GET /api/v1/products/:id         — single product detail by ID or slug
 *
 * Optimization notes:
 *   - $text queries use the product_text_search index (title 10x, description 1x)
 *   - Sorting by "relevance" uses { $meta: "textScore" } — only with $text
 *   - All queries filter on isActive: true for public endpoints
 *   - Compound indexes on (store, isActive, price/createdAt/averageRating) cover
 *     the most common sort operations without collection scans
 *   - Autocomplete uses regex on title (anchored to word boundaries) for instant results
 */

const mongoose = require("mongoose");
const asyncHandler = require("../lib/asyncHandler");
const ApiError = require("../lib/ApiError");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Store = require("../models/Store");
const { validateProductSearchQuery } = require("../validators/productSearch.validator");

// ── Helpers ───────────────────────────────────────────────────────────────────

const parsePagination = (query) => {
  const page  = Math.max(Number(query.page)  || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Resolve a store reference (ID or slug) to an ObjectId.
 * Returns null if not provided or not found.
 */
const resolveStoreId = async (storeRef) => {
  if (!storeRef) return null;
  if (mongoose.Types.ObjectId.isValid(storeRef)) {
    const exists = await Store.exists({ _id: storeRef, status: "active" });
    return exists ? storeRef : null;
  }
  const store = await Store.findOne({
    slug: storeRef.toLowerCase(),
    status: "active",
  }).select("_id");
  return store ? store._id : null;
};

/**
 * Resolve a category reference (ID or slug) to an ObjectId.
 * If storeId is provided, scopes the lookup to that store.
 */
const resolveCategoryId = async (catRef, storeId) => {
  if (!catRef) return null;
  const filter = { isActive: true };
  if (storeId) filter.store = storeId;

  if (mongoose.Types.ObjectId.isValid(catRef)) {
    const cat = await Category.findOne({ _id: catRef, ...filter }).select("_id");
    return cat ? cat._id : null;
  }
  const cat = await Category.findOne({ slug: catRef.toLowerCase(), ...filter }).select("_id");
  return cat ? cat._id : null;
};

/**
 * Build sort options from the query.sort string.
 * "relevance" is only valid when $text search is active.
 */
const buildSort = (sortKey, isTextSearch) => {
  switch (sortKey) {
    case "relevance":
      // textScore sort only works with $text. Fallback to newest otherwise.
      return isTextSearch
        ? { score: { $meta: "textScore" }, createdAt: -1 }
        : { createdAt: -1 };
    case "price_asc":
      return { price: 1 };
    case "price_desc":
      return { price: -1 };
    case "rating":
      return { averageRating: -1, ratingCount: -1 };
    case "popular":
      return { ratingCount: -1, averageRating: -1 };
    case "newest":
    default:
      return { createdAt: -1 };
  }
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/products/search
 *
 * Full product search with filters, sorting, and pagination.
 *
 * Query params:
 *   q         — search query (uses MongoDB $text with weighted scoring)
 *   store     — scope to a single store (ID or slug)
 *   category  — filter by category (ID or slug)
 *   minPrice  — minimum price
 *   maxPrice  — maximum price
 *   inStock   — "true" (default) | "false" | "all"
 *   rating    — minimum average rating (1-5)
 *   sort      — relevance | price_asc | price_desc | newest | rating | popular
 *   limit     — page size (default 20, max 50)
 *   page      — page number
 */
const searchProducts = asyncHandler(async (req, res) => {
  validateProductSearchQuery(req.query);

  const {
    q,
    store: storeRef,
    category: catRef,
    minPrice, maxPrice,
    inStock = "true",
    rating,
    sort: sortKey = "relevance",
  } = req.query;

  const { page, limit, skip } = parsePagination(req.query);

  // ── Build filter ────────────────────────────────────────────────────────
  const filter = { isActive: true };

  // Text search
  const hasQuery = q && q.trim().length >= 2;
  if (hasQuery) {
    filter.$text = { $search: q.trim() };
  }

  // Store scope
  const storeId = await resolveStoreId(storeRef);
  if (storeRef && !storeId) {
    // Store was specified but doesn't exist — return empty results
    return res.status(200).json({
      data: { query: q, page, limit, total: 0, products: [], filters: {} },
    });
  }
  if (storeId) filter.store = storeId;

  // Category
  const categoryId = await resolveCategoryId(catRef, storeId);
  if (catRef && !categoryId) {
    return res.status(200).json({
      data: { query: q, page, limit, total: 0, products: [], filters: {} },
    });
  }
  if (categoryId) filter.category = categoryId;

  // Price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }

  // Stock filter
  if (inStock === "true") {
    filter.stock = { $gt: 0 };
  } else if (inStock === "false") {
    filter.stock = 0;
  }
  // "all" → no stock filter

  // Minimum rating
  if (rating !== undefined) {
    filter.averageRating = { $gte: Number(rating) };
  }

  // ── Build sort ──────────────────────────────────────────────────────────
  const sort = buildSort(sortKey, hasQuery);

  // ── Select fields (projection) ──────────────────────────────────────────
  const projection = {
    title: 1, slug: 1, price: 1, compareAtPrice: 1,
    stock: 1, images: 1, averageRating: 1, ratingCount: 1,
    store: 1, category: 1, isActive: 1, createdAt: 1,
  };
  // Include text score when doing text search (needed for sort + display)
  if (hasQuery) {
    projection.score = { $meta: "textScore" };
  }

  // ── Execute ─────────────────────────────────────────────────────────────
  const [products, total] = await Promise.all([
    Product.find(filter, projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .populate("store", "name slug")
      .lean(),
    Product.countDocuments(filter),
  ]);

  // ── Build aggregated filter info (for frontend filter UI) ───────────────
  // Only compute if this is a search result (not just browsing)
  let filterMeta = null;
  if (hasQuery || storeId || categoryId) {
    // Quick aggregation for price range + available categories in results
    const aggPipeline = [
      { $match: { ...filter } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
          categories: { $addToSet: "$category" },
          totalInStock: { $sum: { $cond: [{ $gt: ["$stock", 0] }, 1, 0] } },
        },
      },
    ];
    // Remove $text from the aggregation filter (aggregation handles it differently)
    const aggFilter = { ...filter };
    delete aggFilter.$text;
    aggPipeline[0].$match = aggFilter;

    const [agg] = await Product.aggregate(aggPipeline);
    if (agg) {
      // Fetch category names for the filter panel
      const catIds = (agg.categories || []).filter(Boolean);
      const categories = catIds.length > 0
        ? await Category.find({ _id: { $in: catIds }, isActive: true })
            .select("name slug")
            .lean()
        : [];

      filterMeta = {
        priceRange: { min: agg.minPrice, max: agg.maxPrice },
        inStockCount: agg.totalInStock,
        availableCategories: categories,
      };
    }
  }

  res.status(200).json({
    data: {
      query: q || null,
      page,
      limit,
      total,
      products,
      filters: filterMeta,
    },
  });
});

/**
 * GET /api/v1/products/suggest?q=mil
 *
 * Autocomplete / search suggestions. Returns up to 8 product titles
 * that match the prefix, grouped by store.
 *
 * Uses regex on title (case-insensitive) — fast with the text index present.
 * Designed for search-as-you-type with minimal latency.
 *
 * Query params:
 *   q     — search prefix (min 2 chars)
 *   store — optional store scope (ID or slug)
 */
const suggestProducts = asyncHandler(async (req, res) => {
  const { q, store: storeRef } = req.query;

  if (!q || String(q).trim().length < 2) {
    return res.status(200).json({ data: { suggestions: [] } });
  }

  const prefix = escapeRegex(q.trim());

  const filter = {
    isActive: true,
    // Match titles starting with the query or containing the word
    title: new RegExp(`(^|\\s)${prefix}`, "i"),
    stock: { $gt: 0 },
  };

  const storeId = await resolveStoreId(storeRef);
  if (storeId) filter.store = storeId;

  const suggestions = await Product.find(filter)
    .sort({ ratingCount: -1, averageRating: -1 })
    .limit(8)
    .select("title slug price images store")
    .populate("store", "name slug")
    .lean();

  res.status(200).json({
    data: {
      query: q.trim(),
      suggestions: suggestions.map((p) => ({
        id:        p._id,
        title:     p.title,
        slug:      p.slug,
        price:     p.price,
        image:     p.images?.[0] || null,
        storeName: p.store?.name || null,
        storeSlug: p.store?.slug || null,
      })),
    },
  });
});

/**
 * GET /api/v1/products/:ref
 *
 * Get a single product by ID or slug.
 * Returns full product detail including variants, options, store info, category.
 */
const getProductDetail = asyncHandler(async (req, res) => {
  const { ref } = req.params;

  let product;
  if (mongoose.Types.ObjectId.isValid(ref)) {
    product = await Product.findOne({ _id: ref, isActive: true })
      .populate("category", "name slug")
      .populate("store", "name slug address contact");
  } else {
    // Slug-based lookup — needs store context since slugs are unique per-store
    // Try to find by slug across all stores (return first active match)
    product = await Product.findOne({ slug: ref.toLowerCase(), isActive: true })
      .populate("category", "name slug")
      .populate("store", "name slug address contact");
  }

  if (!product) throw new ApiError(404, "Product not found");

  res.status(200).json({ data: product });
});

module.exports = {
  searchProducts,
  suggestProducts,
  getProductDetail,
};
