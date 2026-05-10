const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const {
  findEligibleDeliveredOrder,
  recomputeProductRatingStats,
} = require("../lib/reviewUtils");
const { onReviewSubmitted } = require("../lib/notificationHooks");
const PlatformSettings = require("../models/PlatformSettings");
const Product = require("../models/Product");
const Review = require("../models/Review");
const ReviewReport = require("../models/ReviewReport");
const ReviewVote = require("../models/ReviewVote");
const User = require("../models/User");
const {
  validateReportPayload,
  validateReviewPayload,
} = require("../validators/review.validator");

const ensureValidObjectId = (value, label = "id") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
};

const loadProductOrThrow = async (productId) => {
  ensureValidObjectId(productId, "productId");
  const product = await Product.findById(productId).select(
    "_id store title isActive averageRating ratingCount"
  );
  if (!product) throw new ApiError(404, "Product not found");
  return product;
};

const checkEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  ensureValidObjectId(productId, "productId");

  const settings = await PlatformSettings.getOrInit();
  if (settings.features?.reviewsEnabled === false) {
    return res.status(200).json({
      data: { canReview: false, reason: "reviews_disabled" },
    });
  }

  const product = await Product.findById(productId).select("_id store title");
  if (!product) throw new ApiError(404, "Product not found");

  const existing = await Review.findOne({
    product: productId,
    user: req.user.id,
  }).select("_id status rating");

  if (existing) {
    return res.status(200).json({
      data: {
        canReview: false,
        reason: "already_reviewed",
        existingReview: {
          id: existing._id,
          status: existing.status,
          rating: existing.rating,
        },
      },
    });
  }

  if (settings.reviews?.requireVerifiedPurchase !== false) {
    const order = await findEligibleDeliveredOrder(req.user.id, productId);
    if (!order) {
      return res.status(200).json({
        data: { canReview: false, reason: "no_delivered_purchase" },
      });
    }
    return res.status(200).json({
      data: {
        canReview: true,
        verifiedPurchase: true,
        orderNumber: order.orderNumber,
      },
    });
  }

  res.status(200).json({
    data: { canReview: true, verifiedPurchase: false },
  });
});

const submitReview = asyncHandler(async (req, res) => {
  validateReviewPayload(req.body);
  const { productId } = req.params;
  const product = await loadProductOrThrow(productId);

  const settings = await PlatformSettings.getOrInit();
  if (settings.features?.reviewsEnabled === false) {
    throw new ApiError(403, "Reviews are disabled on this platform");
  }

  const requireVerified = settings.reviews?.requireVerifiedPurchase !== false;
  let eligibleOrder = null;
  if (requireVerified) {
    eligibleOrder = await findEligibleDeliveredOrder(req.user.id, product._id);
    if (!eligibleOrder) {
      throw new ApiError(
        403,
        "Only customers who have received a delivered order for this product can review it"
      );
    }
  }

  const existing = await Review.findOne({
    product: product._id,
    user: req.user.id,
  });
  if (existing) {
    throw new ApiError(
      409,
      "You have already reviewed this product. Use update instead."
    );
  }

  const user = await User.findById(req.user.id).select("name");
  const autoApprove = settings.reviews?.autoApprove !== false;

  const review = await Review.create({
    product: product._id,
    store: product.store,
    user: req.user.id,
    order: eligibleOrder?._id || null,
    rating: Number(req.body.rating),
    title: typeof req.body.title === "string" ? req.body.title.trim() : "",
    body: req.body.body.trim(),
    status: autoApprove ? "approved" : "pending",
    isVerifiedPurchase: Boolean(eligibleOrder),
    userSnapshot: { name: user?.name || "Customer" },
  });

  if (autoApprove) {
    await recomputeProductRatingStats(product._id);
  }

  onReviewSubmitted({ review, product, customer: user });

  res.status(201).json({
    message: "Review submitted",
    data: review,
  });
});

const listMyReviews = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { user: req.user.id };
  if (req.query.status) {
    if (!Review.REVIEW_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("product", "title images")
      .populate("store", "name slug"),
    Review.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: items });
});

const updateMyReview = asyncHandler(async (req, res) => {
  validateReviewPayload(req.body, { isPatch: true });
  ensureValidObjectId(req.params.id);

  const review = await Review.findOne({ _id: req.params.id, user: req.user.id });
  if (!review) throw new ApiError(404, "Review not found");

  const settings = await PlatformSettings.getOrInit();

  let touched = false;
  if (req.body.rating !== undefined) {
    review.rating = Number(req.body.rating);
    touched = true;
  }
  if (req.body.body !== undefined) {
    review.body = req.body.body.trim();
    touched = true;
  }
  if (req.body.title !== undefined) {
    review.title = (req.body.title || "").trim();
    touched = true;
  }

  if (touched) {
    if (settings.reviews?.autoApprove !== false) {
      review.status = "approved";
    } else if (review.status !== "pending") {
      // Edits on previously approved/hidden reviews require re-moderation
      review.status = "pending";
    }
  }

  await review.save();
  await recomputeProductRatingStats(review.product);

  res.status(200).json({ message: "Review updated", data: review });
});

const deleteMyReview = asyncHandler(async (req, res) => {
  ensureValidObjectId(req.params.id);
  const review = await Review.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id,
  });
  if (!review) throw new ApiError(404, "Review not found");

  await Promise.all([
    ReviewVote.deleteMany({ review: review._id }),
    ReviewReport.deleteMany({ review: review._id }),
  ]);
  await recomputeProductRatingStats(review.product);

  res.status(200).json({ message: "Review deleted" });
});

const toggleHelpful = asyncHandler(async (req, res) => {
  ensureValidObjectId(req.params.id);

  const review = await Review.findById(req.params.id);
  if (!review || review.status !== "approved") {
    throw new ApiError(404, "Review not found");
  }
  if (String(review.user) === String(req.user.id)) {
    throw new ApiError(400, "You cannot vote on your own review");
  }

  const existing = await ReviewVote.findOne({
    review: review._id,
    user: req.user.id,
  });

  let helpful;
  if (existing) {
    await existing.deleteOne();
    review.helpfulCount = Math.max(0, (review.helpfulCount || 0) - 1);
    helpful = false;
  } else {
    await ReviewVote.create({ review: review._id, user: req.user.id });
    review.helpfulCount = (review.helpfulCount || 0) + 1;
    helpful = true;
  }
  await review.save();

  res.status(200).json({
    message: helpful ? "Marked helpful" : "Helpful vote removed",
    data: { helpful, helpfulCount: review.helpfulCount },
  });
});

const reportReview = asyncHandler(async (req, res) => {
  ensureValidObjectId(req.params.id);
  validateReportPayload(req.body);

  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, "Review not found");
  if (String(review.user) === String(req.user.id)) {
    throw new ApiError(400, "You cannot report your own review");
  }

  let report;
  try {
    report = await ReviewReport.create({
      review: review._id,
      reportedBy: req.user.id,
      reason: req.body.reason,
      note: typeof req.body.note === "string" ? req.body.note : "",
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ApiError(409, "You have already reported this review");
    }
    throw err;
  }

  review.reportCount = (review.reportCount || 0) + 1;

  // Auto-hide after configurable threshold (admin can review reports later)
  const settings = await PlatformSettings.getOrInit();
  const threshold = Number(settings.reviews?.autoHideAfterReports || 0);
  let autoHidden = false;
  if (
    threshold > 0 &&
    review.status === "approved" &&
    review.reportCount >= threshold
  ) {
    review.status = "hidden";
    review.moderation = {
      reviewedBy: null,
      byRole: "system",
      reviewedAt: new Date(),
      reason: `Auto-hidden after reaching ${threshold} reports`,
    };
    autoHidden = true;
  }
  await review.save();

  if (autoHidden) {
    await recomputeProductRatingStats(review.product);
  }

  res.status(201).json({
    message: "Report submitted",
    data: { reportId: report._id, autoHidden },
  });
});

module.exports = {
  checkEligibility,
  submitReview,
  listMyReviews,
  updateMyReview,
  deleteMyReview,
  toggleHelpful,
  reportReview,
};
