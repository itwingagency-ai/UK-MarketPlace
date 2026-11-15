const mongoose = require("mongoose");

/**
 * One coupon used on one order. A platform coupon on a three-store checkout
 * makes three rows sharing a checkoutId; limits count checkouts, not rows.
 * amount is the discount on that order, integer pence.
 */
const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    code: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    checkoutId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    fundedBy: { type: String, enum: ["platform", "vendor"], required: true },
    status: { type: String, enum: ["active", "released"], default: "active", index: true },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ coupon: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("CouponRedemption", couponRedemptionSchema);
