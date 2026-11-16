const mongoose = require("mongoose");

/**
 * Append-only points history. points is signed: credits are positive
 * (earn, referral, restore, adjust+), debits negative (redeem, reverse,
 * expire, adjust-). Never updated or deleted.
 *
 * key makes every entry idempotent, e.g. "earn:<orderId>", "redeem:<orderId>",
 * "restore:<orderId>", "referral:<referralId>"; writing the same key twice is
 * a no-op.
 *
 * Credits carry expiresAt. Expiry is first-in-first-out: points expire only
 * if they haven't already been spent (see lib/loyalty.syncExpiry).
 */
const LEDGER_TYPES = ["earn", "redeem", "restore", "reverse", "expire", "referral", "adjust"];

const loyaltyLedgerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: LEDGER_TYPES, required: true },
    points: { type: Number, required: true },
    key: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    expiresAt: { type: Date, default: null },
    note: { type: String, default: "", maxlength: 200 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

loyaltyLedgerSchema.index({ user: 1, createdAt: -1 });
loyaltyLedgerSchema.statics.TYPES = LEDGER_TYPES;

module.exports = mongoose.model("LoyaltyLedger", loyaltyLedgerSchema);
