const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { recomputeProductRatingStats } = require("../lib/reviewUtils");
const Review = require("../models/Review");
const ReviewReport = require("../models/ReviewReport");
const ReviewVote = require("../models/ReviewVote");
const {
  validateAdminStatusPayload,
  validateReportResolutionPayload,
} = require("../validators/review.validator");

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildReviewFilter = (req) => {
  const filter = {};

  if (req.query.storeId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.storeId)) {
      throw new ApiError(400, "Invalid storeId filter");
    }
    filter.store = req.query.storeId;
  }
  if (req.query.productId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.productId)) {
      throw new ApiError(400, "Invalid productId filter");
    }
    filter.product = req.query.productId;
  }
  if (req.query.userId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
      throw new ApiError(400, "Invalid userId filter");
    }
    filter.user = req.query.userId;
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
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;

  const filter = buildReviewFilter(req);

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ reportCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("product", "title images")
      .populate("store", "name slug")
      .populate("user", "name email"),
    Review.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: items });
});

const getReview = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid review id");
  }
  const review = await Review.findById(req.params.id)
    .populate("product", "title images")
    .populate("store", "name slug")
    .populate("user", "name email")
    .populate("moderation.reviewedBy", "name email role")
    .populate("vendorResponse.respondedBy", "name email role");
  if (!review) throw new ApiError(404, "Review not found");

  const reports = await ReviewReport.find({ review: review._id })
    .sort({ createdAt: -1 })
    .populate("reportedBy", "name email")
    .populate("resolvedBy", "name email role");

  res.status(200).json({ data: { review, reports } });
});

const updateStatus = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid review id");
  }
  validateAdminStatusPayload(req.body);

  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, "Review not found");

  const previousStatus = review.status;
  review.status = req.body.status;
  review.moderation = {
    reviewedBy: req.user.id,
    byRole: req.user.role,
    reviewedAt: new Date(),
    reason:
      typeof req.body.reason === "string"
        ? req.body.reason.slice(0, 500)
        : "",
  };
  await review.save();

  if (previousStatus !== review.status) {
    await recomputeProductRatingStats(review.product);
  }

  res.status(200).json({ message: "Review status updated", data: review });
});

const deleteReview = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid review id");
  }
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw new ApiError(404, "Review not found");

  await Promise.all([
    ReviewVote.deleteMany({ review: review._id }),
    ReviewReport.deleteMany({ review: review._id }),
  ]);
  await recomputeProductRatingStats(review.product);

  res.status(200).json({ message: "Review deleted" });
});

const listReports = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    if (!ReviewReport.REPORT_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.status = req.query.status;
  }
  if (req.query.reason) {
    if (!ReviewReport.REPORT_REASONS.includes(req.query.reason)) {
      throw new ApiError(400, "Invalid reason filter");
    }
    filter.reason = req.query.reason;
  }
  if (req.query.reviewId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.reviewId)) {
      throw new ApiError(400, "Invalid reviewId filter");
    }
    filter.review = req.query.reviewId;
  }

  const [items, total] = await Promise.all([
    ReviewReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reportedBy", "name email")
      .populate({
        path: "review",
        select: "rating title body status product store user",
      }),
    ReviewReport.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: items });
});

const resolveReport = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid report id");
  }
  validateReportResolutionPayload(req.body);

  const report = await ReviewReport.findById(req.params.id);
  if (!report) throw new ApiError(404, "Report not found");
  if (report.status !== "pending") {
    throw new ApiError(409, "Report has already been actioned");
  }

  report.status = req.body.status;
  report.resolvedBy = req.user.id;
  report.resolvedAt = new Date();
  report.resolution =
    typeof req.body.resolution === "string"
      ? req.body.resolution.slice(0, 500)
      : "";
  await report.save();

  res.status(200).json({ message: "Report updated", data: report });
});

module.exports = {
  listReviews,
  getReview,
  updateStatus,
  deleteReview,
  listReports,
  resolveReport,
};
