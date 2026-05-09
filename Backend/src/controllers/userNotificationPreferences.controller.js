const asyncHandler = require("../lib/asyncHandler");
const NotificationPreference = require("../models/NotificationPreference");
const {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
} = require("../lib/notificationTemplates");
const {
  validatePreferenceUpdate,
} = require("../validators/notification.validator");

const serializePreference = (pref) => {
  if (!pref) {
    return {
      globalChannels: { email: true, sms: true, whatsapp: true },
      preferences: {},
    };
  }
  const perEventRaw = pref.preferences || {};
  const perEvent =
    perEventRaw instanceof Map
      ? Object.fromEntries(perEventRaw)
      : perEventRaw;
  return {
    globalChannels: {
      email: pref.globalChannels?.email !== false,
      sms: pref.globalChannels?.sms !== false,
      whatsapp: pref.globalChannels?.whatsapp !== false,
    },
    preferences: perEvent || {},
    updatedAt: pref.updatedAt,
  };
};

const getMyPreferences = asyncHandler(async (req, res) => {
  const pref = await NotificationPreference.findOne({ user: req.user.id });
  res.status(200).json({
    data: {
      ...serializePreference(pref),
      availableChannels: NOTIFICATION_CHANNELS,
      availableEvents: Object.entries(NOTIFICATION_EVENTS).map(
        ([eventType, meta]) => ({
          eventType,
          description: meta.description,
          audience: meta.audience,
        })
      ),
    },
  });
});

const updateMyPreferences = asyncHandler(async (req, res) => {
  validatePreferenceUpdate(req.body);

  const update = {};
  if (req.body.globalChannels) {
    update.globalChannels = {
      email: req.body.globalChannels.email !== false,
      sms: req.body.globalChannels.sms !== false,
      whatsapp: req.body.globalChannels.whatsapp !== false,
    };
  }
  if (req.body.preferences) {
    update.preferences = req.body.preferences;
  }

  const pref = await NotificationPreference.findOneAndUpdate(
    { user: req.user.id },
    { $set: { ...update, user: req.user.id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({
    message: "Notification preferences updated",
    data: serializePreference(pref),
  });
});

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};
