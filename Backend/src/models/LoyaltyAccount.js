const mongoose = require("mongoose");

/**
 * A customer's points balance. Always equals the sum of their LoyaltyLedger
 * entries: every change writes a ledger entry and moves this in the same step.
 */
const loyaltyAccountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    lifetimeEarned: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoyaltyAccount", loyaltyAccountSchema);
