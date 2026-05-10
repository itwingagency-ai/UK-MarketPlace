const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { sanitizePublicReviewView } = require("../lib/reviewUtils");
const Product = require("../models/Product");
const Review = require("../models/Review");

const ensureValidProductId = (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid productId");
  }
};

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  helpful: { helpfulCount: -1, createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest: { rating: 1, createdAt: -1 },
};

const listProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  ensureValidProductId(productId);

  const product = await Product.findById(productId).select("_id");
  if (!product) throw new ApiError(404, "Product not found");

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const sort = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.newest;
  const filter = { product: productId, status: "approved" };

  if (req.query.rating) {
    const rating = Number(req.query.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, "rating filter must be an integer 1..5");
    }
    filter.rating = rating;
  }

  if (req.query.verifiedOnly === "true") {
    filter.isVerifiedPurchase = true;
  }

  const [items, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);

  res.status(200).json({
    page,
    limit,
    total,
    data: items.map(sanitizePublicReviewView),
  });
});

const getProductReviewStats = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  ensureValidProductId(productId);

  const product = await Product.findById(productId).select(
    "averageRating ratingCount ratingDistribution title"
  );
  if (!product) throw new ApiError(404, "Product not found");

  const distribution = product.ratingDistribution || {};
  const verifiedCount = await Review.countDocuments({
    product: productId,
    status: "approved",
    isVerifiedPurchase: true,
  });

  res.status(200).json({
    data: {
      productId,
      title: product.title,
      averageRating: Number(product.averageRating || 0),
      ratingCount: product.ratingCount || 0,
      verifiedCount,
      distribution: {
        1: distribution["1"] || 0,
        2: distribution["2"] || 0,
        3: distribution["3"] || 0,
        4: distribution["4"] || 0,
        5: distribution["5"] || 0,
      },
    },
  });
});

module.exports = {
  listProductReviews,
  getProductReviewStats,
};
