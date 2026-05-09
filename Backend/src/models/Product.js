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

module.exports = mongoose.model("Product", productSchema);
