const mongoose = require("mongoose");

const productOptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 40,
    },
    values: {
      type: [String],
      required: true,
      validate: [
        (arr) => Array.isArray(arr) && arr.length > 0,
        "Each option must have at least one value",
      ],
    },
  },
  { _id: false }
);

const productVariantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    attributes: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    description: {
      type: String,
      default: "",
      maxlength: 2500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    images: {
      type: [String],
      default: [],
    },
    options: {
      type: [productOptionSchema],
      default: [],
    },
    variants: {
      type: [productVariantSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratingDistribution: {
      "1": { type: Number, default: 0, min: 0 },
      "2": { type: Number, default: 0, min: 0 },
      "3": { type: Number, default: 0, min: 0 },
      "4": { type: Number, default: 0, min: 0 },
      "5": { type: Number, default: 0, min: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, flattenMaps: true },
    toObject: { virtuals: true, flattenMaps: true },
  }
);

productSchema.virtual("totalStock").get(function totalStock() {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    return this.variants.reduce(
      (acc, variant) => acc + (Number(variant.stock) || 0),
      0
    );
  }
  return Number(this.stock) || 0;
});

productSchema.virtual("hasVariants").get(function hasVariants() {
  return Array.isArray(this.variants) && this.variants.length > 0;
});

// ── Indexes ──────────────────────────────────────────────────────────────────

// Text index for $text search — title weighted 10x over description
productSchema.index(
  { title: "text", description: "text" },
  {
    weights: { title: 10, description: 1 },
    name: "product_text_search",
    default_language: "english",
  }
);

// Store-scoped slug uniqueness (allows same slug across different stores)
productSchema.index({ store: 1, slug: 1 }, { unique: true, sparse: true });

// Compound indexes for common sort operations on active products
productSchema.index({ store: 1, isActive: 1, price: 1 });
productSchema.index({ store: 1, isActive: 1, createdAt: -1 });
productSchema.index({ store: 1, isActive: 1, averageRating: -1 });

// Global active-products index for cross-store search
productSchema.index({ isActive: 1, createdAt: -1 });

// ── Pre-save: auto-generate slug from title ──────────────────────────────────

productSchema.pre("save", function preSave() {
  if (this.isModified("title") && (!this.slug || this.slug === "")) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 150);
  }
});

module.exports = mongoose.model("Product", productSchema);
