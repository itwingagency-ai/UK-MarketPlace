const mongoose = require("mongoose");

/**
 * How many live checkouts one user has with one coupon. Exists so the
 * per-user limit can be enforced atomically: a conditional upsert on the
 * unique (coupon, user) pair either bumps the count or fails.
 */
const couponUsageSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

couponUsageSchema.index({ coupon: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("CouponUsage", couponUsageSchema);
