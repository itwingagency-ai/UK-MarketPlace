const mongoose = require("mongoose");

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "platform",
      unique: true,
      immutable: true,
    },
    platformName: {
      type: String,
      default: "Multi-Store Platform",
      trim: true,
      maxlength: 120,
    },
    supportEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    supportPhone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    currency: {
      type: String,
      default: "usd",
      lowercase: true,
      trim: true,
      maxlength: 5,
    },
    commission: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
      defaultRate: {
        type: Number,
        default: 0.1,
        min: 0,
        max: 1,
      },
      defaultFixed: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    policies: {
      termsOfService: { type: String, default: "", maxlength: 10000 },
      privacyPolicy: { type: String, default: "", maxlength: 10000 },
      refundPolicy: { type: String, default: "", maxlength: 10000 },
    },
    features: {
      vendorSelfRegistration: { type: Boolean, default: false },
      onlinePaymentEnabled: { type: Boolean, default: true },
      codEnabled: { type: Boolean, default: true },
      reviewsEnabled: { type: Boolean, default: true },
    },
    reviews: {
      autoApprove: { type: Boolean, default: true },
      requireVerifiedPurchase: { type: Boolean, default: true },
      autoHideAfterReports: { type: Number, default: 5, min: 0, max: 1000 },
    },
  },
  { timestamps: true }
);

platformSettingsSchema.statics.getOrInit = async function getOrInit() {
  return this.findOneAndUpdate(
    { key: "platform" },
    { $setOnInsert: { key: "platform" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
