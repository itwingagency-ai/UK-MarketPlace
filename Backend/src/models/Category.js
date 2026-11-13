const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 80,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    // Marketplace category this aisle belongs to (Category Studio). Required
    // for new categories; older ones are mapped by seed-global-categories.js.
    globalCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GlobalCategory",
      default: null,
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    image: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Display order among siblings (lower first); ties fall back to name.
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

categorySchema.index({ store: 1, slug: 1 }, { unique: true });
categorySchema.index({ store: 1, name: 1 });
categorySchema.index({ store: 1, parent: 1, sortOrder: 1 });

module.exports = mongoose.model("Category", categorySchema);
