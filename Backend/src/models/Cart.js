const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      default: "",
      trim: true,
    },
    attributes: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    image: {
      type: String,
      default: "",
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 999,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    // Customer intent only: codes and choices. Every amount these lead to is
    // computed server-side by lib/offers + lib/pricing.
    // At most one platform coupon plus one per store (enforced by the cart controller)
    couponCodes: { type: [String], default: [] },
    // storeId -> tip in integer pence
    tips: { type: Map, of: Number, default: () => new Map() },
    // storeId -> note for that store's order
    notes: { type: Map, of: String, default: () => new Map() },
    // storeId -> codes of removable fees the customer switched off (e.g. "bag")
    declinedFees: { type: Map, of: [String], default: () => new Map() },
    // May the store swap an unavailable item for a close match?
    allowSubstitutions: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, flattenMaps: true },
    toObject: { virtuals: true, flattenMaps: true },
  }
);

module.exports = mongoose.model("Cart", cartSchema);
