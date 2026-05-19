const express = require("express");
const {
  searchProducts,
  suggestProducts,
  getProductDetail,
} = require("../controllers/productSearch.controller");

const router = express.Router();

/**
 * Public product search routes — no authentication required.
 *
 * GET /api/v1/products/search
 *   Full-text product search with filters + pagination.
 *   Query: q, store, category, minPrice, maxPrice, inStock, rating, sort, limit, page
 *
 * GET /api/v1/products/suggest
 *   Autocomplete / search-as-you-type suggestions (max 8 results).
 *   Query: q, store
 *
 * GET /api/v1/products/:ref
 *   Single product detail by ObjectId or slug.
 *
 * NOTE: "search" and "suggest" must come before ":ref" to avoid shadowing.
 */
router.get("/search", searchProducts);
router.get("/suggest", suggestProducts);
router.get("/:ref", getProductDetail);

module.exports = router;
