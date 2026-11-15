const mongoose = require("mongoose");

/**
 * An automatic offer: applies without a code.
 *
 * type "spend_and_save": eligible goods >= minSubtotal -> discountType
 *   percent (1-100) or fixed (pence) off the eligible goods, capped by maxDiscount.
 * type "multibuy": for every (buyQuantity + getQuantity) eligible units, the
 *   getQuantity cheapest are free ("3 for 2" = buy 2, get 1).
 *
 * Eligible goods = items matching products[] or categories[]; both empty
 * means every item in the store's order. Evaluated per store order; when
 * several match, only the one worth most to the customer applies.
 *
 * scope "platform" applies to every store and is platform-funded;
 * scope "store" applies to one store (vendor-funded unless an admin sponsors it).
 */
const promotionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    scope: { type: String, enum: ["platform", "store"], required: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null, index: true },
    type: { type: String, enum: ["spend_and_save", "multibuy"], required: true },
    minSubtotal: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["percent", "fixed"], default: "fixed" },
    discountValue: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: null, min: 0 },
    buyQuantity: { type: Number, default: 0, min: 0 },
    getQuantity: { type: Number, default: 0, min: 0 },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    fundedBy: { type: String, enum: ["platform", "vendor"], required: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

promotionSchema.pre("validate", function checkPromotion() {
  if (this.scope === "store" && !this.store) this.invalidate("store", "A store offer needs a store");
  if (this.scope === "platform") {
    this.store = null;
    this.fundedBy = "platform";
  }
  if (this.type === "spend_and_save") {
    if (!(this.minSubtotal >= 1)) this.invalidate("minSubtotal", "Set the spend needed to unlock the offer");
    if (this.discountType === "percent" && (this.discountValue < 1 || this.discountValue > 100)) {
      this.invalidate("discountValue", "Percentage must be between 1 and 100");
    }
    if (this.discountType === "fixed" && !(this.discountValue >= 1)) {
      this.invalidate("discountValue", "Discount must be at least 1p");
    }
  }
  if (this.type === "multibuy") {
    if (!(this.buyQuantity >= 1) || !(this.getQuantity >= 1)) {
      this.invalidate("buyQuantity", "Multibuy needs buy and free quantities of at least 1");
    }
  }
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "End date must be after the start date");
  }
});

module.exports = mongoose.model("Promotion", promotionSchema);
