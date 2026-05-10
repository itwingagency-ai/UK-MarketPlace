const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const NotificationTemplate = require("../models/NotificationTemplate");
const {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  getDefaultTemplate,
  isKnownEventType,
  listAllTemplates,
} = require("../lib/notificationTemplates");
const {
  validateTemplatePayload,
} = require("../validators/notification.validator");

const ensureValidEventChannel = (eventType, channel) => {
  if (!isKnownEventType(eventType)) {
    throw new ApiError(404, `Unknown event type: ${eventType}`);
  }
  if (!NOTIFICATION_CHANNELS.includes(channel)) {
    throw new ApiError(404, `Unknown channel: ${channel}`);
  }
  if (!getDefaultTemplate(eventType, channel)) {
    throw new ApiError(
      404,
      `No template defined for ${eventType} on channel ${channel}`
    );
  }
};

const listTemplates = asyncHandler(async (req, res) => {
  const all = await listAllTemplates();
  res.status(200).json({
    data: {
      events: NOTIFICATION_EVENTS,
      channels: NOTIFICATION_CHANNELS,
      templates: all,
    },
  });
});

const getTemplate = asyncHandler(async (req, res) => {
  const { eventType, channel } = req.params;
  ensureValidEventChannel(eventType, channel);

  const fallback = getDefaultTemplate(eventType, channel);
  const override = await NotificationTemplate.findOne({ eventType, channel });

  res.status(200).json({
    data: {
      eventType,
      channel,
      meta: NOTIFICATION_EVENTS[eventType] || {},
      defaultSubject: fallback.subject || "",
      defaultBody: fallback.body || "",
      override: override
        ? {
            subject: override.subject,
            body: override.body,
            isActive: override.isActive,
            updatedAt: override.updatedAt,
            updatedBy: override.updatedBy,
          }
        : null,
    },
  });
});

const upsertTemplate = asyncHandler(async (req, res) => {
  const { eventType, channel } = req.params;
  ensureValidEventChannel(eventType, channel);
  validateTemplatePayload(req.body);

  const tpl = await NotificationTemplate.findOneAndUpdate(
    { eventType, channel },
    {
      $set: {
        eventType,
        channel,
        subject: req.body.subject || "",
        body: req.body.body,
        isActive: req.body.isActive !== false,
        updatedBy: req.user.id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({
    message: "Template saved",
    data: tpl,
  });
});

const deleteTemplate = asyncHandler(async (req, res) => {
  const { eventType, channel } = req.params;
  ensureValidEventChannel(eventType, channel);

  await NotificationTemplate.deleteOne({ eventType, channel });
  res.status(200).json({
    message: "Override removed; default template will be used",
  });
});

module.exports = {
  listTemplates,
  getTemplate,
  upsertTemplate,
  deleteTemplate,
};
