const mongoose = require("mongoose");

const shippingMethodSchema = new mongoose.Schema(
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
    code: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 40,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    fee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 90,
    },
    maxDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 90,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

shippingMethodSchema.index({ store: 1, code: 1 }, { unique: true });
shippingMethodSchema.index({ store: 1, isActive: 1, sortOrder: 1, fee: 1 });

module.exports = mongoose.model("ShippingMethod", shippingMethodSchema);
