const mongoose = require("mongoose");

/**
 * Marketplace-wide category managed by the admin in Category Studio.
 * Every store category maps to one of these (`Category.globalCategory`),
 * which is how customers can browse "Bakery" across all nearby stores.
 *
 * Two levels at most: a root, or a sub-category of a root.
 */

// Pre-rendered 3D icons shipped with the apps (Frontend/src/assets/3d,
// Frontend-Web/public/3d). Stored as a key so each app resolves its own file.
const ICON_KEYS = [
  "cat-alcohol",
  "cat-baby",
  "cat-bakery",
  "cat-breakfast",
  "cat-dairy-eggs",
  "cat-drinks",
  "cat-electronics",
  "cat-flowers",
  "cat-frozen",
  "cat-fruit-veg",
  "cat-halal",
  "cat-health-beauty",
  "cat-household",
  "cat-meat-fish",
  "cat-off-licence",
  "cat-pet",
  "cat-pharmacy",
  "cat-ready-meals",
  "cat-snacks-sweets",
  "cat-stationery",
  "cat-tea-coffee",
  "cat-tinned-cupboard",
  "cat-vegan",
  "cat-world-foods",
];

// Morphic accent palettes from the design tokens
const ACCENT_COLORS = [
  "groceriesMint",
  "bakeryAmber",
  "dairySky",
  "meatCoral",
  "drinksViolet",
  "pharmacyTeal",
  "frozenCyan",
  "householdIndigo",
];

const globalCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 60,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GlobalCategory",
      default: null,
      index: true,
    },
    description: { type: String, default: "", maxlength: 300 },
    icon3d: {
      assetKey: { type: String, enum: ICON_KEYS, required: true },
    },
    accentColor: { type: String, enum: ACCENT_COLORS, default: "groceriesMint" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    keywords: { type: [String], default: [] },
    seo: {
      title: { type: String, default: "", maxlength: 70 },
      description: { type: String, default: "", maxlength: 160 },
    },
  },
  { timestamps: true }
);

globalCategorySchema.index({ parent: 1, sortOrder: 1 });

globalCategorySchema.statics.ICON_KEYS = ICON_KEYS;
globalCategorySchema.statics.ACCENT_COLORS = ACCENT_COLORS;

module.exports = mongoose.model("GlobalCategory", globalCategorySchema);
