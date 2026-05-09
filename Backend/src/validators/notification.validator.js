const ApiError = require("../lib/ApiError");
const {
  isKnownEventType,
  NOTIFICATION_CHANNELS,
} = require("../lib/notificationTemplates");

const isPlainObject = (v) =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const validatePreferenceUpdate = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid preferences payload");
  }

  if (payload.globalChannels !== undefined && payload.globalChannels !== null) {
    if (!isPlainObject(payload.globalChannels)) {
      throw new ApiError(400, "globalChannels must be an object");
    }
    for (const [key, value] of Object.entries(payload.globalChannels)) {
      if (!NOTIFICATION_CHANNELS.includes(key)) {
        throw new ApiError(400, `Unknown channel: ${key}`);
      }
      if (typeof value !== "boolean") {
        throw new ApiError(400, `globalChannels.${key} must be boolean`);
      }
    }
  }

  if (payload.preferences !== undefined && payload.preferences !== null) {
    if (!isPlainObject(payload.preferences)) {
      throw new ApiError(400, "preferences must be an object");
    }
    for (const [eventType, eventPrefs] of Object.entries(payload.preferences)) {
      if (!isKnownEventType(eventType)) {
        throw new ApiError(400, `Unknown event type: ${eventType}`);
      }
      if (!isPlainObject(eventPrefs)) {
        throw new ApiError(
          400,
          `preferences[${eventType}] must be an object`
        );
      }
      for (const [channel, value] of Object.entries(eventPrefs)) {
        if (!NOTIFICATION_CHANNELS.includes(channel)) {
          throw new ApiError(
            400,
            `Unknown channel ${channel} for event ${eventType}`
          );
        }
        if (typeof value !== "boolean") {
          throw new ApiError(
            400,
            `preferences[${eventType}].${channel} must be boolean`
          );
        }
      }
    }
  }
};

const validateTemplatePayload = (payload, { isPatch = false } = {}) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid template payload");
  }

  if (!isPatch || payload.body !== undefined) {
    if (typeof payload.body !== "string" || payload.body.trim().length === 0) {
      throw new ApiError(400, "body is required");
    }
    if (payload.body.length > 4000) {
      throw new ApiError(400, "body must be 4000 characters or less");
    }
  }

  if (payload.subject !== undefined && payload.subject !== null) {
    if (typeof payload.subject !== "string" || payload.subject.length > 200) {
      throw new ApiError(400, "subject must be a string up to 200 characters");
    }
  }

  if (payload.isActive !== undefined && typeof payload.isActive !== "boolean") {
    throw new ApiError(400, "isActive must be boolean");
  }
};

module.exports = {
  validatePreferenceUpdate,
  validateTemplatePayload,
};
