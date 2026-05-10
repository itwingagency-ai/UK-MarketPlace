const env = require("../config/env");

let cachedTransporter = null;
let cachedNodemailer = null;

const isEmailConfigured = () =>
  Boolean(env.smtp.host && env.smtp.fromAddress);

const loadNodemailer = () => {
  if (cachedNodemailer) return cachedNodemailer;
  // eslint-disable-next-line global-require
  cachedNodemailer = require("nodemailer");
  return cachedNodemailer;
};

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  if (!isEmailConfigured()) return null;

  const nodemailer = loadNodemailer();
  cachedTransporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth:
      env.smtp.user && env.smtp.pass
        ? { user: env.smtp.user, pass: env.smtp.pass }
        : undefined,
  });
  return cachedTransporter;
};

const buildFromHeader = () => {
  if (!env.smtp.fromAddress) return "";
  return env.smtp.fromName
    ? `"${env.smtp.fromName}" <${env.smtp.fromAddress}>`
    : env.smtp.fromAddress;
};

const sendEmail = async ({ to, subject, body, html }) => {
  if (!to) {
    return {
      status: "skipped",
      reason: "no_recipient",
      providerMessageId: "",
      error: "",
    };
  }
  if (!isEmailConfigured()) {
    if (env.notifications.debug) {
      // eslint-disable-next-line no-console
      console.log("[email:dev]", { to, subject, body });
    }
    return {
      status: "skipped",
      reason: "not_configured",
      providerMessageId: "",
      error: "",
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: buildFromHeader(),
      to,
      subject: subject || "",
      text: body || "",
      html: html || undefined,
    });
    return {
      status: "sent",
      reason: "",
      providerMessageId: info?.messageId || "",
      error: "",
    };
  } catch (err) {
    return {
      status: "failed",
      reason: "",
      providerMessageId: "",
      error: err?.message || "Unknown email error",
    };
  }
};

module.exports = {
  isEmailConfigured,
  sendEmail,
};
