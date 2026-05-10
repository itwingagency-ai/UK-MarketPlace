const mongoose = require("mongoose");

const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"];

const notificationTemplateSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    channel: {
      type: String,
      required: true,
      enum: NOTIFICATION_CHANNELS,
    },
    subject: {
      type: String,
      default: "",
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

notificationTemplateSchema.index(
  { eventType: 1, channel: 1 },
  { unique: true }
);

notificationTemplateSchema.statics.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;

module.exports = mongoose.model(
  "NotificationTemplate",
  notificationTemplateSchema
);
