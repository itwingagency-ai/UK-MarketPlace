/**
 * The platform's charging currency has one source of truth:
 * PlatformSettings.currency (ISO 4217, lowercase, default "gbp").
 * Stripe calls, payment transactions and notifications all read it from here.
 */
const PlatformSettings = require("../models/PlatformSettings");

const FALLBACK_CURRENCY = "gbp";

const getPlatformCurrency = async () => {
  const settings = await PlatformSettings.getOrInit();
  return (settings.currency || FALLBACK_CURRENCY).toLowerCase();
};

/** For display paths (notifications) that must never throw. */
const getPlatformCurrencySafe = async () => {
  try {
    return await getPlatformCurrency();
  } catch (_err) {
    return FALLBACK_CURRENCY;
  }
};

module.exports = { getPlatformCurrency, getPlatformCurrencySafe, FALLBACK_CURRENCY };
