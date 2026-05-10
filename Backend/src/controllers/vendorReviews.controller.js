const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { recomputeProductRatingStats } = require("../lib/reviewUtils");
const { onVendorReviewResponse } = require("../lib/notificationHooks");
const Product = require("../models/Product");
const Review = require("../models/Review");
const Store = require("../models/Store");
const {
  validateVendorResponsePayload,
} = require("../validators/review.validator");

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildListFilter = (req) => {
  const filter = { ...req.storeScopeFilter };

  if (req.query.productId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.productId)) {
      throw new ApiError(400, "Invalid productId filter");
    }
    filter.product = req.query.productId;
  }

  if (req.query.status) {
    if (!Review.REVIEW_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.status = req.query.status;
  }

  if (req.query.rating) {
    const rating = Number(req.query.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, "rating filter must be an integer 1..5");
    }
    filter.rating = rating;
  }

  if (req.query.hasReports === "true") {
    filter.reportCount = { $gt: 0 };
  }

  if (req.query.search) {
    const re = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
    filter.$or = [{ title: re }, { body: re }, { "userSnapshot.name": re }];
  }

  return filter;
};

const listReviews = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = buildListFilter(req);

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("product", "title images")
      .populate("user", "name email"),
    Review.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: items });
});

const getReview = asyncHandler(async (req, res) => {
  const review = req.scopedResource;
  if (!review) throw new ApiError(404, "Review not found");
  await review.populate([
    { path: "product", select: "title images" },
    { path: "user", select: "name email" },
    { path: "vendorResponse.respondedBy", select: "name email" },
  ]);
  res.status(200).json({ data: review });
});

const setVendorResponse = asyncHandler(async (req, res) => {
  validateVendorResponsePayload(req.body);
  const review = req.scopedResource;
  if (!review) throw new ApiError(404, "Review not found");

  review.vendorResponse = {
    body: req.body.body.trim(),
    respondedBy: req.user.id,
    respondedAt: new Date(),
  };
  await review.save();

  // Best-effort context for the customer notification
  const [product, store] = await Promise.all([
    Product.findById(review.product).select("title"),
    Store.findById(review.store).select("name"),
  ]);
  onVendorReviewResponse({ review, product, store });

  res.status(200).json({
    message: "Response saved",
    data: review,
  });
});

const clearVendorResponse = asyncHandler(async (req, res) => {
  const review = req.scopedResource;
  if (!review) throw new ApiError(404, "Review not found");

  review.vendorResponse = {
    body: "",
    respondedBy: null,
    respondedAt: null,
  };
  await review.save();

  res.status(200).json({ message: "Response cleared", data: review });
});

const setReviewVisibility = (action) =>
  asyncHandler(async (req, res) => {
    const review = req.scopedResource;
    if (!review) throw new ApiError(404, "Review not found");

    if (action === "hide") {
      if (review.status === "hidden") {
        throw new ApiError(409, "Review is already hidden");
      }
      review.status = "hidden";
    } else {
      if (review.status !== "hidden") {
        throw new ApiError(409, "Review is not currently hidden");
      }
      review.status = "approved";
    }

    review.moderation = {
      reviewedBy: req.user.id,
      byRole: req.user.role,
      reviewedAt: new Date(),
      reason:
        typeof req.body?.reason === "string"
          ? req.body.reason.slice(0, 500)
          : "",
    };
    await review.save();
    await recomputeProductRatingStats(review.product);

    res.status(200).json({
      message: action === "hide" ? "Review hidden" : "Review unhidden",
      data: review,
    });
  });

const reviewStats = asyncHandler(async (req, res) => {
  const filter = { ...req.storeScopeFilter };
  if (req.query.productId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.productId)) {
      throw new ApiError(400, "Invalid productId filter");
    }
    filter.product = new mongoose.Types.ObjectId(req.query.productId);
  }

  const [agg] = await Review.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        approved: {
          $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        hidden: {
          $sum: { $cond: [{ $eq: ["$status", "hidden"] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
        },
        avg: {
          $avg: {
            $cond: [{ $eq: ["$status", "approved"] }, "$rating", null],
          },
        },
        reported: {
          $sum: { $cond: [{ $gt: ["$reportCount", 0] }, 1, 0] },
        },
        unanswered: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "approved"] },
                  {
                    $or: [
                      { $eq: ["$vendorResponse.body", ""] },
                      { $eq: [{ $type: "$vendorResponse.body" }, "missing"] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  res.status(200).json({
    data: {
      total: agg?.total || 0,
      averageRating: agg?.avg ? Number(agg.avg.toFixed(2)) : 0,
      byStatus: {
        approved: agg?.approved || 0,
        pending: agg?.pending || 0,
        hidden: agg?.hidden || 0,
        rejected: agg?.rejected || 0,
      },
      reportedCount: agg?.reported || 0,
      unansweredCount: agg?.unanswered || 0,
    },
  });
});

module.exports = {
  listReviews,
  getReview,
  setVendorResponse,
  clearVendorResponse,
  hideReview: setReviewVisibility("hide"),
  unhideReview: setReviewVisibility("unhide"),
  reviewStats,
};
