const mongoose = require("mongoose");

/**
 * Admin-managed home-screen banners (and location campaigns).
 * target: what a tap opens — a store (slug), a category (id), a coupon code
 * (added to the basket), an https link, or nothing.
 * geo: when set, the banner shows only to customers within radiusKm.
 */
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    subtitle: { type: String, default: "", trim: true, maxlength: 140 },
    imageUrl: { type: String, default: "", trim: true },
    target: {
      type: { type: String, enum: ["none", "store", "category", "coupon", "url"], default: "none" },
      value: { type: String, default: "", trim: true, maxlength: 300 },
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      radiusKm: { type: Number, default: null, min: 0.1, max: 500 },
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
