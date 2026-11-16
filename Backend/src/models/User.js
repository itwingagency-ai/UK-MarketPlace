const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const validator = require("validator");

const ROLES = ["admin", "vendor", "customer"];
const STATUSES = ["active", "suspended", "unverified"];

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home", trim: true, maxlength: 40 },
    fullName: { type: String, default: "", trim: true, maxlength: 80 },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, default: "", trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, default: "", trim: true, maxlength: 80 },
    postalCode: { type: String, default: "", trim: true, maxlength: 20 },
    country: { type: String, default: "", trim: true, maxlength: 80 },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => validator.isEmail(value),
        message: "Invalid email format",
      },
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "customer",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "active",
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    // Expo push tokens for this user's devices (see lib/pushService)
    pushTokens: {
      type: [
        new mongoose.Schema(
          {
            token: { type: String, required: true, maxlength: 200 },
            platform: { type: String, default: "", maxlength: 20 },
            updatedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
      select: false,
    },
    favoriteStores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
      },
    ],
    favoriteProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    // This customer's invite code (made on first visit to Rewards)
    referralCode: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
