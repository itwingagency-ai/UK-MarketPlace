const mongoose = require("mongoose");

const REPORT_REASONS = ["spam", "abusive", "off_topic", "fake", "other"];
const REPORT_STATUSES = ["pending", "resolved", "dismissed"];

const reviewReportSchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    note: { type: String, default: "", maxlength: 500 },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "pending",
      index: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: { type: Date, default: null },
    resolution: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

reviewReportSchema.index({ review: 1, reportedBy: 1 }, { unique: true });
reviewReportSchema.index({ status: 1, createdAt: -1 });

reviewReportSchema.statics.REPORT_REASONS = REPORT_REASONS;
reviewReportSchema.statics.REPORT_STATUSES = REPORT_STATUSES;

module.exports = mongoose.model("ReviewReport", reviewReportSchema);
