const mongoose = require("mongoose");

const TX_PROVIDERS = ["stripe", "cod", "manual"];
const TX_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "refunded",
];

const eventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    status: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const paymentTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        index: true,
      },
    ],
    provider: {
      type: String,
      enum: TX_PROVIDERS,
      required: true,
    },
    status: {
      type: String,
      enum: TX_STATUSES,
      default: "pending",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "usd",
      lowercase: true,
    },
    providerSessionId: {
      type: String,
      default: "",
      index: true,
    },
    providerIntentId: {
      type: String,
      default: "",
      index: true,
    },
    providerChargeId: {
      type: String,
      default: "",
    },
    checkoutUrl: {
      type: String,
      default: "",
    },
    failureReason: {
      type: String,
      default: "",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    events: {
      type: [eventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

paymentTransactionSchema.statics.PROVIDERS = TX_PROVIDERS;
paymentTransactionSchema.statics.STATUSES = TX_STATUSES;

module.exports = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema
);
