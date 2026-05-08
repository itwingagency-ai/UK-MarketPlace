const mongoose = require("mongoose");

const storeSettingsSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      unique: true,
      index: true,
    },
    branding: {
      displayName: { type: String, default: "" },
      logoUrl: { type: String, default: "" },
      themeColor: { type: String, default: "" },
    },
    businessHours: {
      type: String,
      default: "",
    },
    policies: {
      returnPolicy: { type: String, default: "" },
      shippingPolicy: { type: String, default: "" },
    },
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      whatsappEnabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StoreSettings", storeSettingsSchema);
