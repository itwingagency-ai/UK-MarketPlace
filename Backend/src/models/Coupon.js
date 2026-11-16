const mongoose = require("mongoose");

/**
 * A code a customer types at the basket.
 *
 * Money fields (value for "fixed", maxDiscount, minSubtotal) are integer pence.
 * For "percent", value is a whole percentage 1-100.
 *
 * scope "platform": admin-made, works across every store in the cart, and is
 *   always platform-funded (vendors are paid as if full price was charged).
 * scope "store": works on one store's order only. Vendor-made coupons are
 *   vendor-funded; an admin may sponsor a store coupon (fundedBy "platform").
 */
const COUPON_TYPES = ["percent", "fixed", "free_delivery"];
const COUPON_SCOPES = ["platform", "store"];

const couponSchema = new mongoose.Schema(
  {
    // Stored upper-case; one code means one coupon across the whole platform
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[A-Z0-9_-]+$/,
    },
    description: { type: String, default: "", trim: true, maxlength: 200 },
    scope: { type: String, enum: COUPON_SCOPES, required: true },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true,
    },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: null, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null, min: 1 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    firstOrderOnly: { type: Boolean, default: false },
    fundedBy: { type: String, enum: ["platform", "vendor"], required: true },
    isActive: { type: Boolean, default: true, index: true },
    // Only this customer may use it (referral welcome codes)
    allowedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Checkouts currently holding this coupon (claimed atomically at placement,
    // released when every order of that checkout is cancelled)
    redemptionCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

couponSchema.pre("validate", function checkScope() {
  if (this.scope === "store" && !this.store) {
    this.invalidate("store", "A store coupon needs a store");
  }
  if (this.scope === "platform") {
    this.store = null;
    this.fundedBy = "platform";
  }
  if (this.type === "percent" && (this.value < 1 || this.value > 100)) {
    this.invalidate("value", "Percentage must be between 1 and 100");
  }
  if (this.type === "fixed" && !(this.value >= 1)) {
    this.invalidate("value", "Fixed discount must be at least 1p");
  }
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "End date must be after the start date");
  }
});

couponSchema.statics.TYPES = COUPON_TYPES;
couponSchema.statics.SCOPES = COUPON_SCOPES;

module.exports = mongoose.model("Coupon", couponSchema);
