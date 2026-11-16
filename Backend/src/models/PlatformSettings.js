const mongoose = require("mongoose");

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "platform",
      unique: true,
      immutable: true,
    },
    platformName: {
      type: String,
      default: "Multi-Store Platform",
      trim: true,
      maxlength: 120,
    },
    supportEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    supportPhone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    // The one charging currency (ISO 4217, lowercase). Read via lib/currency.
    currency: {
      type: String,
      default: "gbp",
      lowercase: true,
      trim: true,
      maxlength: 5,
    },
    commission: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
      defaultRate: {
        type: Number,
        default: 0.1,
        min: 0,
        max: 1,
      },
      defaultFixed: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    policies: {
      termsOfService: { type: String, default: "", maxlength: 10000 },
      privacyPolicy: { type: String, default: "", maxlength: 10000 },
      refundPolicy: { type: String, default: "", maxlength: 10000 },
    },
    features: {
      vendorSelfRegistration: { type: Boolean, default: false },
      onlinePaymentEnabled: { type: Boolean, default: true },
      codEnabled: { type: Boolean, default: true },
      reviewsEnabled: { type: Boolean, default: true },
    },
    // Customer-facing fees, all amounts integer pence, computed per store order
    // on goods before discounts. service + smallOrder are platform revenue;
    // bag is the store's (UK carrier-bag charge) and the customer may remove it.
    fees: {
      service: {
        enabled: { type: Boolean, default: false },
        percent: { type: Number, default: 0, min: 0, max: 20 },
        min: { type: Number, default: 0, min: 0 },
        max: { type: Number, default: 0, min: 0 }, // 0 = no cap
        label: { type: String, default: "Service fee", trim: true, maxlength: 60 },
        info: { type: String, default: "Helps us run the marketplace", trim: true, maxlength: 200 },
      },
      smallOrder: {
        enabled: { type: Boolean, default: false },
        threshold: { type: Number, default: 0, min: 0 },
        amount: { type: Number, default: 0, min: 0 },
        label: { type: String, default: "Small order fee", trim: true, maxlength: 60 },
        info: { type: String, default: "Applies to orders under the minimum", trim: true, maxlength: 200 },
      },
      bag: {
        enabled: { type: Boolean, default: false },
        amount: { type: Number, default: 0, min: 0 },
        label: { type: String, default: "Carrier bags", trim: true, maxlength: 60 },
        info: { type: String, default: "Paid to the store. Remove it if you don't need bags", trim: true, maxlength: 200 },
      },
    },
    // Rewards points. Off until an admin turns it on; stores also opt in
    // (Store.loyaltyOptIn). The platform pays for points spent.
    loyalty: {
      enabled: { type: Boolean, default: false },
      earnPointsPerPound: { type: Number, default: 1, min: 0, max: 100 },
      pointValuePence: { type: Number, default: 1, min: 1, max: 100 }, // 100 points = £1
      minRedeemPoints: { type: Number, default: 100, min: 0 },
      maxRedeemPoints: { type: Number, default: 0, min: 0 }, // per checkout, 0 = no cap
      minBasketToRedeem: { type: Number, default: 0, min: 0 }, // pence, goods at taking-part stores
      expiryMonths: { type: Number, default: 12, min: 1, max: 60 },
      referral: {
        enabled: { type: Boolean, default: false },
        referrerPoints: { type: Number, default: 500, min: 0 },
        refereeCouponValue: { type: Number, default: 500, min: 0 }, // pence off the first order
        refereeMinSubtotal: { type: Number, default: 1500, min: 0 },
      },
    },
    // One-off data fixes already applied to this document
    migrations: {
      currencyFromEnvAt: { type: Date, default: null },
    },
    reviews: {
      autoApprove: { type: Boolean, default: true },
      requireVerifiedPurchase: { type: Boolean, default: true },
      autoHideAfterReports: { type: Number, default: 5, min: 0, max: 1000 },
    },
  },
  { timestamps: true }
);

platformSettingsSchema.statics.getOrInit = async function getOrInit() {
  let doc = await this.findOneAndUpdate(
    { key: "platform" },
    { $setOnInsert: { key: "platform" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Before Wave 0 the schema defaulted to "usd" while Stripe charged in
  // PLATFORM_CURRENCY. Copy that env value over the stale default once, so
  // switching Stripe to read this setting cannot change the charging currency.
  if (!doc.migrations?.currencyFromEnvAt) {
    // eslint-disable-next-line global-require
    const legacy = require("../config/env").legacyPlatformCurrency;
    if (legacy && doc.currency === "usd" && legacy !== "usd") doc.currency = legacy;
    doc.set("migrations.currencyFromEnvAt", new Date());
    await doc.save();
  }
  if (!doc.supportEmail || !doc.supportPhone) {
    const User = mongoose.model("User");
    const admin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
    let changed = false;
    if (!doc.supportEmail) {
      doc.supportEmail = admin?.email || "superadmin@marketplace.co.uk";
      changed = true;
    }
    if (!doc.supportPhone) {
      doc.supportPhone = admin?.phone || "+44 20 7946 0921";
      changed = true;
    }
    if (changed) {
      await doc.save();
    }
  }
  return doc;
};

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
