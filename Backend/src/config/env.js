const dotenv = require("dotenv");

dotenv.config();

const requiredVars = [
  "PORT",
  "MONGODB_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "refreshToken",
<<<<<<< HEAD
=======
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    successUrl:
      process.env.STRIPE_SUCCESS_URL || "http://localhost:3000/checkout/success",
    cancelUrl:
      process.env.STRIPE_CANCEL_URL || "http://localhost:3000/checkout/cancel",
  },
  platformCurrency: (process.env.PLATFORM_CURRENCY || "usd").toLowerCase(),
  appName: process.env.APP_NAME || "Marketplace",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  notifications: {
    enabled: (process.env.NOTIFICATIONS_ENABLED || "true").toLowerCase() !== "false",
    debug: (process.env.NOTIFICATIONS_DEBUG || "false").toLowerCase() === "true",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    fromAddress: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || "",
    fromName: process.env.SMTP_FROM_NAME || process.env.APP_NAME || "Marketplace",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    smsFrom: process.env.TWILIO_SMS_FROM || "",
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || "",
  },
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
};

module.exports = env;
