const mongoose = require("mongoose");

const NOTIFICATION_CHANNEL_STATUS = [
  "queued",
  "sent",
  "skipped",
  "failed",
];

const channelAttemptSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      required: true,
      enum: ["email", "sms", "whatsapp"],
    },
    status: {
      type: String,
      enum: NOTIFICATION_CHANNEL_STATUS,
      default: "queued",
    },
    to: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    skippedReason: { type: String, default: "" },
    attemptedAt: { type: Date, default: Date.now },
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
      maxlength: 80,
    },
    recipient: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    subject: { type: String, default: "" },
    bodyPreview: { type: String, default: "", maxlength: 500 },
    channels: { type: [channelAttemptSchema], default: [] },
    related: {
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
      },
      store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        default: null,
      },
      vendorApplication: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VendorApplication",
        default: null,
      },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

notificationSchema.statics.NOTIFICATION_CHANNEL_STATUS = NOTIFICATION_CHANNEL_STATUS;

module.exports = mongoose.model("Notification", notificationSchema);
