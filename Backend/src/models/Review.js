const mongoose = require("mongoose");

const REVIEW_STATUSES = ["pending", "approved", "rejected", "hidden"];

const moderationSchema = new mongoose.Schema(
  {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    byRole: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reason: { type: String, default: "", maxlength: 500 },
  },
  { _id: false }
);

const vendorResponseSchema = new mongoose.Schema(
  {
    body: { type: String, default: "", maxlength: 2000 },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    respondedAt: { type: Date, default: null },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: REVIEW_STATUSES,
      default: "pending",
      index: true,
    },
    isVerifiedPurchase: { type: Boolean, default: false, index: true },
    moderation: { type: moderationSchema, default: () => ({}) },
    vendorResponse: { type: vendorResponseSchema, default: () => ({}) },
    helpfulCount: { type: Number, default: 0, min: 0 },
    reportCount: { type: Number, default: 0, min: 0 },
    userSnapshot: {
      name: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ store: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, reportCount: -1, createdAt: -1 });

reviewSchema.statics.REVIEW_STATUSES = REVIEW_STATUSES;

module.exports = mongoose.model("Review", reviewSchema);
