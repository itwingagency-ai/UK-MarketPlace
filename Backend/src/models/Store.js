const mongoose = require("mongoose");

const STORE_STATUS = ["active", "suspended"];

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
<<<<<<< HEAD
=======
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
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
  },
  { timestamps: true }
);

module.exports = mongoose.model("Store", storeSchema);
