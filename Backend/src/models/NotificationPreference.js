const mongoose = require("mongoose");

const channelPrefSchema = new mongoose.Schema(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
  },
  { _id: false }
);

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // Sparse map of overrides keyed by eventType. Missing eventType → all
    // channels enabled. Each entry is a partial { email?, sms?, whatsapp? }.
    preferences: {
      type: Map,
      of: channelPrefSchema,
      default: () => new Map(),
    },
    // Global per-channel kill switch — turning email off here suppresses email
    // for ALL events even if the per-event override has email enabled.
    globalChannels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "NotificationPreference",
  notificationPreferenceSchema
);
