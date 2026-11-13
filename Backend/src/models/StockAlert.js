const mongoose = require("mongoose");

/**
 * "Notify me when back in stock" — one row per customer per product/size.
 * Cleared (notifiedAt set) once the customer has been told.
 */
const stockAlertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Specific size/option, or null for products without variants
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One open request per customer per product/size
stockAlertSchema.index(
  { user: 1, product: 1, variantId: 1 },
  { unique: true, partialFilterExpression: { notifiedAt: null } }
);
stockAlertSchema.index({ product: 1, notifiedAt: 1 });

module.exports = mongoose.model("StockAlert", stockAlertSchema);
