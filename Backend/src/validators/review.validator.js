const ApiError = require("../lib/ApiError");
const Review = require("../models/Review");
const ReviewReport = require("../models/ReviewReport");

const isPlainObject = (v) =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const validateReviewPayload = (payload, { isPatch = false } = {}) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid review payload");
  }

  if (!isPatch || payload.rating !== undefined) {
    const n = Number(payload.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      throw new ApiError(400, "rating must be an integer 1..5");
    }
  }

  if (!isPatch || payload.body !== undefined) {
    if (typeof payload.body !== "string" || payload.body.trim().length === 0) {
      throw new ApiError(400, "body is required");
    }
    if (payload.body.length > 4000) {
      throw new ApiError(400, "body must be 4000 characters or less");
    }
  }

  if (payload.title !== undefined && payload.title !== null) {
    if (typeof payload.title !== "string" || payload.title.length > 120) {
      throw new ApiError(400, "title must be a string up to 120 chars");
    }
  }
};

const validateVendorResponsePayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid response payload");
  }
  if (typeof payload.body !== "string" || payload.body.trim().length === 0) {
    throw new ApiError(400, "response body is required");
  }
  if (payload.body.length > 2000) {
    throw new ApiError(400, "response body must be 2000 characters or less");
  }
};

const validateAdminStatusPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid status update payload");
  }
  if (!Review.REVIEW_STATUSES.includes(payload.status)) {
    throw new ApiError(
      400,
      `status must be one of: ${Review.REVIEW_STATUSES.join(", ")}`
    );
  }
  if (payload.reason !== undefined && payload.reason !== null) {
    if (typeof payload.reason !== "string" || payload.reason.length > 500) {
      throw new ApiError(400, "reason must be a string up to 500 chars");
    }
  }
};

const validateReportPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid report payload");
  }
  if (!ReviewReport.REPORT_REASONS.includes(payload.reason)) {
    throw new ApiError(
      400,
      `reason must be one of: ${ReviewReport.REPORT_REASONS.join(", ")}`
    );
  }
  if (payload.note !== undefined && payload.note !== null) {
    if (typeof payload.note !== "string" || payload.note.length > 500) {
      throw new ApiError(400, "note must be a string up to 500 chars");
    }
  }
};

const validateReportResolutionPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid resolution payload");
  }
  if (!["resolved", "dismissed"].includes(payload.status)) {
    throw new ApiError(400, "status must be 'resolved' or 'dismissed'");
  }
  if (payload.resolution !== undefined && payload.resolution !== null) {
    if (
      typeof payload.resolution !== "string" ||
      payload.resolution.length > 500
    ) {
      throw new ApiError(400, "resolution must be a string up to 500 chars");
    }
  }
};

module.exports = {
  validateReviewPayload,
  validateVendorResponsePayload,
  validateAdminStatusPayload,
  validateReportPayload,
  validateReportResolutionPayload,
};
