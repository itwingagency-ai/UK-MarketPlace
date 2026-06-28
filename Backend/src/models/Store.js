const mongoose = require("mongoose");

const STORE_STATUS = ["active", "suspended"];

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Per-day slot stored inside the operatingHours Map
const operatingHoursSlotSchema = new mongoose.Schema(
  {
    open: { type: String, default: "09:00", trim: true },  // "HH:mm" 24-hour
    close: { type: String, default: "22:00", trim: true }, // "HH:mm" 24-hour
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: STORE_STATUS,
      default: "active",
    },
    contact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    address: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    commissionType: {
      type: String,
      enum: ["percentage", "fixed", null],
      default: null,
    },
    commissionRate: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    commissionFixed: {
      type: Number,
      default: null,
      min: 0,
    },

    // ── Geospatial ────────────────────────────────────────────────────────────
    // GeoJSON Point — coordinates MUST be [longitude, latitude] (GeoJSON order)
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
        validate: {
          validator: (arr) =>
            Array.isArray(arr) &&
            arr.length === 2 &&
            arr[0] >= -180 && arr[0] <= 180 &&
            arr[1] >= -90  && arr[1] <= 90,
          message: "coordinates must be [longitude, latitude] within valid ranges",
        },
      },
    },
    // Maximum km from store the store will deliver to
    deliveryRadiusKm: {
      type: Number,
      default: 5,
      min: 0.1,
      max: 100,
    },
    // Map: day-of-week (lowercase) → { open, close, isClosed }
    operatingHours: {
      type: Map,
      of: operatingHoursSlotSchema,
      default: () => new Map(),
    },
    // Flag: true once vendor has explicitly geocoded & saved real coordinates.
    // Prevents stores at (0,0) from showing up in geo queries.
    locationSet: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, flattenMaps: true },
    toObject: { virtuals: true, flattenMaps: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// 2dsphere enables $nearSphere / $geoWithin / $geoIntersects
storeSchema.index({ location: "2dsphere" });
// Compound: active stores with a set location — the exact filter used in discovery
storeSchema.index({ status: 1, locationSet: 1 });

// ── Statics ───────────────────────────────────────────────────────────────────
storeSchema.statics.STORE_STATUS = STORE_STATUS;
storeSchema.statics.DAYS_OF_WEEK = DAYS_OF_WEEK;

module.exports = mongoose.model("Store", storeSchema);
