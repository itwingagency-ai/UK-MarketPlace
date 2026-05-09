const NotificationTemplate = require("../models/NotificationTemplate");

const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"];

const NOTIFICATION_EVENTS = {
  "account.welcome": {
    description: "Sent when a user registers",
    audience: "user",
    placeholders: ["appName", "name", "email", "loginUrl"],
  },
  "account.password_changed": {
    description: "Sent when a user changes their password",
    audience: "user",
    placeholders: ["appName", "name", "email"],
  },
  "order.placed.customer": {
    description: "Confirmation sent to the customer after placing an order",
    audience: "customer",
    placeholders: [
      "appName",
      "name",
      "orderNumber",
      "storeName",
      "total",
      "currency",
      "paymentMethod",
      "trackUrl",
    ],
  },
  "order.placed.vendor": {
    description: "Notification to the vendor when a new order arrives",
    audience: "vendor",
    placeholders: [
      "appName",
      "vendorName",
      "storeName",
      "orderNumber",
      "customerName",
      "total",
      "currency",
      "dashboardUrl",
    ],
  },
  "order.payment_succeeded": {
    description: "Sent to the customer when payment is captured",
    audience: "customer",
    placeholders: [
      "appName",
      "name",
      "orderNumber",
      "total",
      "currency",
      "trackUrl",
    ],
  },
  "order.payment_failed": {
    description: "Sent to the customer when payment fails or expires",
    audience: "customer",
    placeholders: ["appName", "name", "orderNumber", "reason", "retryUrl"],
  },
  "order.shipped": {
    description: "Sent when a vendor ships an order",
    audience: "customer",
    placeholders: [
      "appName",
      "name",
      "orderNumber",
      "carrier",
      "trackingNumber",
      "trackingUrl",
      "etaMin",
      "etaMax",
      "trackUrl",
    ],
  },
  "order.delivered": {
    description: "Sent when an order is marked delivered",
    audience: "customer",
    placeholders: ["appName", "name", "orderNumber"],
  },
  "order.cancelled": {
    description: "Sent when an order is cancelled",
    audience: "customer",
    placeholders: ["appName", "name", "orderNumber", "reason"],
  },
  "order.shipment_event": {
    description: "Sent when a tracking event is added during delivery",
    audience: "customer",
    placeholders: [
      "appName",
      "name",
      "orderNumber",
      "eventStatus",
      "location",
      "note",
      "trackUrl",
    ],
  },
  "vendor.application_approved": {
    description: "Sent when an admin approves a vendor application",
    audience: "vendor",
    placeholders: ["appName", "name", "storeName", "dashboardUrl"],
  },
  "vendor.application_rejected": {
    description: "Sent when an admin rejects a vendor application",
    audience: "user",
    placeholders: ["appName", "name", "reason"],
  },
  "review.submitted.vendor": {
    description: "Notifies the vendor when a new review is submitted on their product",
    audience: "vendor",
    placeholders: [
      "appName",
      "vendorName",
      "storeName",
      "productTitle",
      "rating",
      "customerName",
      "dashboardUrl",
    ],
  },
  "review.responded.customer": {
    description: "Notifies the customer when a vendor responds to their review",
    audience: "customer",
    placeholders: [
      "appName",
      "name",
      "storeName",
      "productTitle",
      "responseSnippet",
      "reviewUrl",
    ],
  },
};

const DEFAULT_TEMPLATES = {
  "account.welcome": {
    email: {
      subject: "Welcome to {{appName}}",
      body:
        "Hi {{name}},\n\n" +
        "Welcome to {{appName}}! Your account ({{email}}) is ready to use.\n\n" +
        "You can sign in any time at {{loginUrl}}.\n\n" +
        "— The {{appName}} team",
    },
    sms: { body: "Welcome to {{appName}}, {{name}}! Your account is ready." },
    whatsapp: {
      body: "Welcome to {{appName}}, {{name}}! Your account is ready.",
    },
  },
  "account.password_changed": {
    email: {
      subject: "Your {{appName}} password was changed",
      body:
        "Hi {{name}},\n\n" +
        "Your {{appName}} account password was just changed. " +
        "If this wasn't you, please contact support immediately.\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "{{appName}}: your password was just changed. " +
        "If this wasn't you, contact support.",
    },
    whatsapp: {
      body:
        "{{appName}}: your password was just changed. " +
        "If this wasn't you, contact support.",
    },
  },
  "order.placed.customer": {
    email: {
      subject: "Order confirmation — {{orderNumber}}",
      body:
        "Hi {{name}},\n\n" +
        "Thanks for your order from {{storeName}}!\n\n" +
        "Order number: {{orderNumber}}\n" +
        "Total: {{total}} {{currency}}\n" +
        "Payment: {{paymentMethod}}\n\n" +
        "Track your order: {{trackUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "Order {{orderNumber}} placed at {{storeName}}. " +
        "Total {{total}} {{currency}}. Track: {{trackUrl}}",
    },
    whatsapp: {
      body:
        "Hi {{name}}! Your {{appName}} order {{orderNumber}} from {{storeName}} " +
        "is confirmed. Total {{total}} {{currency}}. Track: {{trackUrl}}",
    },
  },
  "order.placed.vendor": {
    email: {
      subject: "New order received — {{orderNumber}}",
      body:
        "Hi {{vendorName}},\n\n" +
        "You just received a new order at {{storeName}}.\n\n" +
        "Order: {{orderNumber}}\n" +
        "Customer: {{customerName}}\n" +
        "Total: {{total}} {{currency}}\n\n" +
        "Manage it here: {{dashboardUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "New order {{orderNumber}} at {{storeName}}: {{total}} {{currency}}. " +
        "Open dashboard.",
    },
    whatsapp: {
      body:
        "New {{appName}} order {{orderNumber}} at {{storeName}} from " +
        "{{customerName}}. Total {{total}} {{currency}}.",
    },
  },
  "order.payment_succeeded": {
    email: {
      subject: "Payment received for order {{orderNumber}}",
      body:
        "Hi {{name}},\n\n" +
        "We've received your payment of {{total}} {{currency}} " +
        "for order {{orderNumber}}.\n\n" +
        "Track your order: {{trackUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "Payment of {{total}} {{currency}} received for order {{orderNumber}}. " +
        "Track: {{trackUrl}}",
    },
    whatsapp: {
      body:
        "Payment received for {{appName}} order {{orderNumber}}: " +
        "{{total}} {{currency}}.",
    },
  },
  "order.payment_failed": {
    email: {
      subject: "Payment issue with order {{orderNumber}}",
      body:
        "Hi {{name}},\n\n" +
        "We couldn't complete payment for order {{orderNumber}}.\n" +
        "Reason: {{reason}}\n\n" +
        "You can retry payment here: {{retryUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "Payment failed for order {{orderNumber}}: {{reason}}. " +
        "Retry: {{retryUrl}}",
    },
    whatsapp: {
      body:
        "Payment failed for {{appName}} order {{orderNumber}}: {{reason}}. " +
        "Retry payment in your account.",
    },
  },
  "order.shipped": {
    email: {
      subject: "Your order {{orderNumber}} has shipped",
      body:
        "Hi {{name}},\n\n" +
        "Your order {{orderNumber}} is on its way!\n\n" +
        "Carrier: {{carrier}}\n" +
        "Tracking number: {{trackingNumber}}\n" +
        "Carrier link: {{trackingUrl}}\n" +
        "Estimated delivery: {{etaMin}} - {{etaMax}}\n\n" +
        "Track here: {{trackUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "Order {{orderNumber}} shipped via {{carrier}} ({{trackingNumber}}). " +
        "Track: {{trackUrl}}",
    },
    whatsapp: {
      body:
        "Your {{appName}} order {{orderNumber}} has shipped via {{carrier}}. " +
        "Tracking: {{trackingNumber}}. Track: {{trackUrl}}",
    },
  },
  "order.delivered": {
    email: {
      subject: "Your order {{orderNumber}} was delivered",
      body:
        "Hi {{name}},\n\n" +
        "Order {{orderNumber}} has been delivered. We hope you love it!\n\n" +
        "If anything's wrong, just reply to this email.\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body: "Order {{orderNumber}} was delivered. Thanks for shopping with {{appName}}!",
    },
    whatsapp: {
      body: "Order {{orderNumber}} was delivered. Thanks for shopping with {{appName}}!",
    },
  },
  "order.cancelled": {
    email: {
      subject: "Order {{orderNumber}} cancelled",
      body:
        "Hi {{name}},\n\n" +
        "Order {{orderNumber}} has been cancelled.\n" +
        "Reason: {{reason}}\n\n" +
        "If you've already paid, your refund will be issued shortly.\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body: "Order {{orderNumber}} cancelled: {{reason}}",
    },
    whatsapp: {
      body: "{{appName}} order {{orderNumber}} cancelled: {{reason}}",
    },
  },
  "order.shipment_event": {
    email: {
      subject: "Shipment update for order {{orderNumber}}",
      body:
        "Hi {{name}},\n\n" +
        "Update on order {{orderNumber}}:\n" +
        "Status: {{eventStatus}}\n" +
        "Location: {{location}}\n" +
        "Note: {{note}}\n\n" +
        "Track here: {{trackUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "Order {{orderNumber}} update: {{eventStatus}} {{location}}. " +
        "Track: {{trackUrl}}",
    },
    whatsapp: {
      body:
        "{{appName}} order {{orderNumber}} update: {{eventStatus}} " +
        "{{location}}. {{note}}",
    },
  },
  "vendor.application_approved": {
    email: {
      subject: "Your store application is approved",
      body:
        "Hi {{name}},\n\n" +
        "Great news — your application to open {{storeName}} on {{appName}} " +
        "was approved.\n\n" +
        "Open your vendor dashboard: {{dashboardUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "{{appName}}: your store {{storeName}} is approved! " +
        "Open dashboard: {{dashboardUrl}}",
    },
    whatsapp: {
      body:
        "{{appName}}: your store {{storeName}} is approved. " +
        "Visit your dashboard to get started.",
    },
  },
  "vendor.application_rejected": {
    email: {
      subject: "Update on your store application",
      body:
        "Hi {{name}},\n\n" +
        "Thanks for applying to sell on {{appName}}. " +
        "Unfortunately your application wasn't approved this time.\n" +
        "Reason: {{reason}}\n\n" +
        "Feel free to reapply once the issues above are addressed.\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body: "{{appName}}: your store application was not approved. {{reason}}",
    },
    whatsapp: {
      body: "{{appName}}: your store application was not approved. {{reason}}",
    },
  },
  "review.submitted.vendor": {
    email: {
      subject: "New review for {{productTitle}}",
      body:
        "Hi {{vendorName}},\n\n" +
        "{{customerName}} just left a {{rating}}-star review on " +
        "\"{{productTitle}}\" at {{storeName}}.\n\n" +
        "Manage and respond from your dashboard: {{dashboardUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "New {{rating}}★ review for {{productTitle}} at {{storeName}}. " +
        "Open your dashboard to respond.",
    },
    whatsapp: {
      body:
        "New {{rating}}★ review for {{productTitle}} from {{customerName}} " +
        "at {{storeName}}.",
    },
  },
  "review.responded.customer": {
    email: {
      subject: "{{storeName}} responded to your review",
      body:
        "Hi {{name}},\n\n" +
        "{{storeName}} replied to your review of \"{{productTitle}}\":\n\n" +
        "\"{{responseSnippet}}\"\n\n" +
        "See the full response: {{reviewUrl}}\n\n" +
        "— The {{appName}} team",
    },
    sms: {
      body:
        "{{storeName}} replied to your review of {{productTitle}}: " +
        "\"{{responseSnippet}}\"",
    },
    whatsapp: {
      body:
        "{{storeName}} replied to your review of {{productTitle}}: " +
        "\"{{responseSnippet}}\"",
    },
  },
};

const isKnownEventType = (eventType) =>
  Object.prototype.hasOwnProperty.call(NOTIFICATION_EVENTS, eventType);

const renderTemplate = (template, context) => {
  const ctx = context || {};
  const replace = (text) =>
    typeof text === "string"
      ? text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
          if (Object.prototype.hasOwnProperty.call(ctx, key)) {
            const value = ctx[key];
            if (value === null || value === undefined) return "";
            return String(value);
          }
          return "";
        })
      : "";

  return {
    subject: template.subject ? replace(template.subject) : "",
    body: replace(template.body),
  };
};

const getDefaultTemplate = (eventType, channel) => {
  const event = DEFAULT_TEMPLATES[eventType];
  if (!event) return null;
  const tpl = event[channel];
  if (!tpl) return null;
  return { subject: tpl.subject || "", body: tpl.body || "" };
};

const resolveTemplate = async (eventType, channel) => {
  const override = await NotificationTemplate.findOne({
    eventType,
    channel,
    isActive: true,
  }).lean();

  if (override) {
    return {
      source: "override",
      subject: override.subject || "",
      body: override.body || "",
    };
  }

  const fallback = getDefaultTemplate(eventType, channel);
  if (fallback) {
    return {
      source: "default",
      subject: fallback.subject,
      body: fallback.body,
    };
  }
  return null;
};

const listAllTemplates = async () => {
  const overrides = await NotificationTemplate.find({}).lean();
  const overrideMap = new Map();
  for (const tpl of overrides) {
    overrideMap.set(`${tpl.eventType}::${tpl.channel}`, tpl);
  }

  const result = [];
  for (const [eventType, defaults] of Object.entries(DEFAULT_TEMPLATES)) {
    for (const channel of NOTIFICATION_CHANNELS) {
      const def = defaults[channel];
      if (!def) continue;
      const override = overrideMap.get(`${eventType}::${channel}`);
      result.push({
        eventType,
        channel,
        meta: NOTIFICATION_EVENTS[eventType] || {},
        defaultSubject: def.subject || "",
        defaultBody: def.body || "",
        override: override
          ? {
              subject: override.subject || "",
              body: override.body || "",
              isActive: override.isActive,
              updatedAt: override.updatedAt,
              updatedBy: override.updatedBy,
            }
          : null,
      });
    }
  }
  return result;
};

module.exports = {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  DEFAULT_TEMPLATES,
  isKnownEventType,
  renderTemplate,
  getDefaultTemplate,
  resolveTemplate,
  listAllTemplates,
};
