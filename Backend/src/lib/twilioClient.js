const env = require("../config/env");

let cachedClient = null;
let cachedTwilio = null;

const isTwilioConfigured = () =>
  Boolean(env.twilio.accountSid && env.twilio.authToken);

const isSmsConfigured = () => isTwilioConfigured() && Boolean(env.twilio.smsFrom);

const isWhatsAppConfigured = () =>
  isTwilioConfigured() && Boolean(env.twilio.whatsappFrom);

const loadTwilio = () => {
  if (cachedTwilio) return cachedTwilio;
  // eslint-disable-next-line global-require
  cachedTwilio = require("twilio");
  return cachedTwilio;
};

const getClient = () => {
  if (cachedClient) return cachedClient;
  if (!isTwilioConfigured()) return null;
  const twilio = loadTwilio();
  cachedClient = twilio(env.twilio.accountSid, env.twilio.authToken);
  return cachedClient;
};

const normalizeWhatsappAddress = (number) => {
  if (!number) return "";
  return number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
};

const sendSms = async ({ to, body }) => {
  if (!to) {
    return {
      status: "skipped",
      reason: "no_recipient",
      providerMessageId: "",
      error: "",
    };
  }
  if (!isSmsConfigured()) {
    if (env.notifications.debug) {
      // eslint-disable-next-line no-console
      console.log("[sms:dev]", { to, body });
    }
    return {
      status: "skipped",
      reason: "not_configured",
      providerMessageId: "",
      error: "",
    };
  }
  try {
    const client = getClient();
    const msg = await client.messages.create({
      to,
      from: env.twilio.smsFrom,
      body,
    });
    return {
      status: "sent",
      reason: "",
      providerMessageId: msg?.sid || "",
      error: "",
    };
  } catch (err) {
    return {
      status: "failed",
      reason: "",
      providerMessageId: "",
      error: err?.message || "Unknown SMS error",
    };
  }
};

const sendWhatsApp = async ({ to, body }) => {
  if (!to) {
    return {
      status: "skipped",
      reason: "no_recipient",
      providerMessageId: "",
      error: "",
    };
  }
  if (!isWhatsAppConfigured()) {
    if (env.notifications.debug) {
      // eslint-disable-next-line no-console
      console.log("[whatsapp:dev]", { to, body });
    }
    return {
      status: "skipped",
      reason: "not_configured",
      providerMessageId: "",
      error: "",
    };
  }
  try {
    const client = getClient();
    const msg = await client.messages.create({
      to: normalizeWhatsappAddress(to),
      from: normalizeWhatsappAddress(env.twilio.whatsappFrom),
      body,
    });
    return {
      status: "sent",
      reason: "",
      providerMessageId: msg?.sid || "",
      error: "",
    };
  } catch (err) {
    return {
      status: "failed",
      reason: "",
      providerMessageId: "",
      error: err?.message || "Unknown WhatsApp error",
    };
  }
};

module.exports = {
  isTwilioConfigured,
  isSmsConfigured,
  isWhatsAppConfigured,
  sendSms,
  sendWhatsApp,
};
