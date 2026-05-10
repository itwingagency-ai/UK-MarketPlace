const env = require("../config/env");
const Notification = require("../models/Notification");
const NotificationPreference = require("../models/NotificationPreference");
const User = require("../models/User");
const { sendEmail } = require("./emailClient");
const { sendSms, sendWhatsApp } = require("./twilioClient");
const {
  isKnownEventType,
  NOTIFICATION_CHANNELS,
  renderTemplate,
  resolveTemplate,
} = require("./notificationTemplates");

const safeRunAsync = (fn, label) => {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[notifications] ${label} failed:`, err?.message || err);
    });
};

const resolveUser = async (userOrId) => {
  if (!userOrId) return null;
  if (typeof userOrId === "string") {
    return User.findById(userOrId);
  }
  if (typeof userOrId === "object" && userOrId._id) {
    return userOrId;
  }
  return null;
};

const getEffectiveChannelPrefs = async (userId, eventType) => {
  if (!userId) {
    return { email: true, sms: true, whatsapp: true };
  }
  const pref = await NotificationPreference.findOne({ user: userId }).lean();
  if (!pref) return { email: true, sms: true, whatsapp: true };

  const global = pref.globalChannels || {
    email: true,
    sms: true,
    whatsapp: true,
  };
  // Mongoose Map serializes to either Map or plain object via .lean(); normalize.
  const perEventRaw = pref.preferences || {};
  const perEvent =
    perEventRaw instanceof Map
      ? Object.fromEntries(perEventRaw)
      : perEventRaw;
  const overrides = perEvent[eventType] || {};

  const merge = (channel) => {
    const globalAllow = global[channel] !== false;
    if (!globalAllow) return false;
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, channel)) {
      return overrides[channel] !== false;
    }
    return true;
  };

  return {
    email: merge("email"),
    sms: merge("sms"),
    whatsapp: merge("whatsapp"),
  };
};

const buildRecipientChannels = (recipient, requestedChannels) => {
  const channels = (requestedChannels && requestedChannels.length
    ? requestedChannels
    : NOTIFICATION_CHANNELS
  ).filter((c) => NOTIFICATION_CHANNELS.includes(c));
  return channels.map((channel) => ({
    channel,
    to:
      channel === "email"
        ? (recipient.email || "").trim()
        : (recipient.phone || "").trim(),
  }));
};

const sendOnChannel = async (channel, { to, subject, body }) => {
  if (channel === "email") {
    return sendEmail({ to, subject, body });
  }
  if (channel === "sms") {
    return sendSms({ to, body });
  }
  if (channel === "whatsapp") {
    return sendWhatsApp({ to, body });
  }
  return {
    status: "failed",
    reason: "",
    providerMessageId: "",
    error: `Unknown channel: ${channel}`,
  };
};

/**
 * Dispatch a notification for the given user + event.
 * NEVER throws — all errors are swallowed and recorded into the Notification log.
 *
 * @param {Object} options
 * @param {String|Object} options.user            User id or user document
 * @param {String} options.eventType              One of NOTIFICATION_EVENTS
 * @param {Object} [options.context]              Template variables
 * @param {String[]} [options.channels]           Restrict channels (default: all)
 * @param {Object} [options.related]              Related ids (order/store/etc.)
 * @param {Object} [options.recipientOverride]    Manually set recipient { name, email, phone }
 */
const notify = async ({
  user,
  eventType,
  context = {},
  channels: requestedChannels = null,
  related = {},
  recipientOverride = null,
}) => {
  if (!env.notifications.enabled) return null;
  if (!eventType || !isKnownEventType(eventType)) return null;

  try {
    const userDoc = recipientOverride ? null : await resolveUser(user);
    const userId = userDoc?._id || (typeof user === "string" ? user : null);

    const recipient = recipientOverride || {
      name: userDoc?.name || "",
      email: userDoc?.email || "",
      phone: userDoc?.phone || "",
    };

    const prefs = await getEffectiveChannelPrefs(userId, eventType);
    const planned = buildRecipientChannels(recipient, requestedChannels).filter(
      (c) => prefs[c.channel] !== false
    );

    if (planned.length === 0) return null;

    const baseContext = {
      appName: env.appName,
      ...context,
      name: context.name || recipient.name || "there",
    };

    const attempts = [];
    let renderedSubject = "";
    let renderedBodyPreview = "";

    for (const plan of planned) {
      // eslint-disable-next-line no-await-in-loop
      const tpl = await resolveTemplate(eventType, plan.channel);
      if (!tpl) {
        attempts.push({
          channel: plan.channel,
          status: "skipped",
          to: plan.to,
          providerMessageId: "",
          error: "",
          skippedReason: "no_template",
          attemptedAt: new Date(),
          sentAt: null,
        });
        continue;
      }

      const rendered = renderTemplate(tpl, baseContext);

      if (plan.channel === "email" && !renderedSubject) {
        renderedSubject = rendered.subject;
      }
      if (!renderedBodyPreview) {
        renderedBodyPreview = (rendered.body || "").slice(0, 500);
      }

      if (!plan.to) {
        attempts.push({
          channel: plan.channel,
          status: "skipped",
          to: "",
          providerMessageId: "",
          error: "",
          skippedReason: "no_recipient",
          attemptedAt: new Date(),
          sentAt: null,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const result = await sendOnChannel(plan.channel, {
        to: plan.to,
        subject: rendered.subject,
        body: rendered.body,
      });

      attempts.push({
        channel: plan.channel,
        status: result.status,
        to: plan.to,
        providerMessageId: result.providerMessageId || "",
        error: result.error || "",
        skippedReason: result.reason || "",
        attemptedAt: new Date(),
        sentAt: result.status === "sent" ? new Date() : null,
      });
    }

    const log = await Notification.create({
      user: userId || null,
      eventType,
      recipient,
      subject: renderedSubject,
      bodyPreview: renderedBodyPreview,
      channels: attempts,
      related: {
        order: related.order || null,
        store: related.store || null,
        vendorApplication: related.vendorApplication || null,
      },
    });
    return log;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[notifications] dispatch failed for event="${eventType}":`,
      err?.message || err
    );
    return null;
  }
};

/**
 * Fire-and-forget wrapper. Use from controllers to avoid blocking the request.
 * Logs (but does not propagate) any unexpected errors.
 */
const notifyAsync = (options) => {
  safeRunAsync(() => notify(options), `notify(${options?.eventType || "?"})`);
};

module.exports = {
  notify,
  notifyAsync,
};
