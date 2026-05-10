const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");

const toObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(value);

/**
 * Recompute Product.averageRating / ratingCount / ratingDistribution from
 * the current set of approved reviews. Call after any change that affects
 * the visible review set (create/update/delete/status change).
 */
const recomputeProductRatingStats = async (productId) => {
  if (!productId) return null;
  const productObjectId = toObjectId(productId);

  const [agg] = await Review.aggregate([
    { $match: { product: productObjectId, status: "approved" } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avg: { $avg: "$rating" },
        d1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        d2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
        d3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
        d4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
        d5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
      },
    },
  ]);

  const stats = agg
    ? {
        averageRating: Number((agg.avg || 0).toFixed(2)),
        ratingCount: agg.count || 0,
        ratingDistribution: {
          1: agg.d1 || 0,
          2: agg.d2 || 0,
          3: agg.d3 || 0,
          4: agg.d4 || 0,
          5: agg.d5 || 0,
        },
      }
    : {
        averageRating: 0,
        ratingCount: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };

  await Product.updateOne(
    { _id: productObjectId },
    {
      $set: {
        averageRating: stats.averageRating,
        ratingCount: stats.ratingCount,
        ratingDistribution: stats.ratingDistribution,
      },
    }
  );

  return stats;
};

/**
 * Returns the most recent delivered order in which `userId` purchased the
 * given product, if any. Used as proof of verified purchase.
 */
const findEligibleDeliveredOrder = async (userId, productId) => {
  if (!userId || !productId) return null;
  return Order.findOne({
    customer: userId,
    orderStatus: "delivered",
    "items.product": productId,
  })
    .sort({ "tracking.deliveredAt": -1, createdAt: -1 })
    .select("_id store tracking createdAt orderNumber");
};

const sanitizePublicReviewView = (review) => {
  if (!review) return null;
  const obj = typeof review.toObject === "function" ? review.toObject() : review;
  return {
    id: obj._id,
    product: obj.product,
    rating: obj.rating,
    title: obj.title || "",
    body: obj.body,
    isVerifiedPurchase: Boolean(obj.isVerifiedPurchase),
    helpfulCount: obj.helpfulCount || 0,
    user: {
      name: obj.userSnapshot?.name || "",
    },
    vendorResponse:
      obj.vendorResponse && obj.vendorResponse.body
        ? {
            body: obj.vendorResponse.body,
            respondedAt: obj.vendorResponse.respondedAt,
          }
        : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

module.exports = {
  recomputeProductRatingStats,
  findEligibleDeliveredOrder,
  sanitizePublicReviewView,
};
