const ApiError = require("../lib/ApiError");

const ALLOWED_SORT_OPTIONS = [
  "relevance",    // text score (only with $text search)
  "price_asc",
  "price_desc",
  "newest",
  "rating",
  "popular",      // ratingCount — most reviewed
];

const ALLOWED_IN_STOCK = ["true", "false", "all"];

/**
 * Validates query params for product search endpoints.
 *
 * Supports:
 *   q         — search query (min 2 chars, max 120)
 *   category  — category ID or slug
 *   store     — store ID or slug (scope search to a single store)
 *   minPrice  — minimum price filter
 *   maxPrice  — maximum price filter
 *   inStock   — "true" | "false" | "all" (default "true")
 *   rating    — minimum average rating (1-5)
 *   sort      — relevance | price_asc | price_desc | newest | rating | popular
 *   limit     — page size (1-50, default 20)
 *   page      — page number (default 1)
 */
const validateProductSearchQuery = (query) => {
  const { q, minPrice, maxPrice, rating, sort, limit, page, inStock } = query;

  // "q" is optional — if missing, returns all products (browse mode)
  if (q !== undefined) {
    const trimmed = String(q).trim();
    if (trimmed.length < 2) {
      throw new ApiError(400, "Search query 'q' must be at least 2 characters");
    }
    if (trimmed.length > 120) {
      throw new ApiError(400, "Search query 'q' must be 120 characters or less");
    }
  }

  if (minPrice !== undefined) {
    const n = Number(minPrice);
    if (Number.isNaN(n) || n < 0) {
      throw new ApiError(400, "'minPrice' must be a non-negative number");
    }
  }

  if (maxPrice !== undefined) {
    const n = Number(maxPrice);
    if (Number.isNaN(n) || n < 0) {
      throw new ApiError(400, "'maxPrice' must be a non-negative number");
    }
  }

  if (minPrice !== undefined && maxPrice !== undefined) {
    if (Number(minPrice) > Number(maxPrice)) {
      throw new ApiError(400, "'minPrice' cannot be greater than 'maxPrice'");
    }
  }

  if (rating !== undefined) {
    const n = Number(rating);
    if (Number.isNaN(n) || n < 1 || n > 5) {
      throw new ApiError(400, "'rating' must be between 1 and 5");
    }
  }

  if (sort !== undefined && !ALLOWED_SORT_OPTIONS.includes(sort)) {
    throw new ApiError(
      400,
      `'sort' must be one of: ${ALLOWED_SORT_OPTIONS.join(", ")}`
    );
  }

  if (inStock !== undefined && !ALLOWED_IN_STOCK.includes(inStock)) {
    throw new ApiError(400, "'inStock' must be 'true', 'false', or 'all'");
  }

  if (limit !== undefined) {
    const l = Number(limit);
    if (!Number.isInteger(l) || l < 1 || l > 50) {
      throw new ApiError(400, "'limit' must be an integer between 1 and 50");
    }
  }

  if (page !== undefined) {
    const p = Number(page);
    if (!Number.isInteger(p) || p < 1) {
      throw new ApiError(400, "'page' must be a positive integer");
    }
  }
};

module.exports = {
  validateProductSearchQuery,
  ALLOWED_SORT_OPTIONS,
};
