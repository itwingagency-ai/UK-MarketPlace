const mongoose = require("mongoose");

/**
 * One customer inviting another. One per referee, ever.
 *
 * pending  - signed up with the code; waiting for their first completed order
 * review   - first order done, but a fraud check matched (same phone, address
 *            or device); an admin approves or rejects
 * rewarded - referrer credited (LoyaltyLedger key "referral:<id>")
 * rejected - no reward
 */
const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    code: { type: String, required: true },
    status: { type: String, enum: ["pending", "review", "rewarded", "rejected"], default: "pending", index: true },
    flags: { type: [String], default: [] },
    // Welcome coupon made for the referee (Coupon.allowedUser = referee)
    couponCode: { type: String, default: "" },
    rewardPoints: { type: Number, default: 0, min: 0 },
    qualifyingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    rewardedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewNote: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", referralSchema);
