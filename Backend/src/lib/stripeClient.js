const ApiError = require("./ApiError");
const env = require("../config/env");

let cachedClient = null;

const getStripeClient = () => {
  if (cachedClient) return cachedClient;
  if (!env.stripe.secretKey) {
    throw new ApiError(
      503,
      "Online payments are not configured (missing STRIPE_SECRET_KEY)"
    );
  }
  // eslint-disable-next-line global-require
  const Stripe = require("stripe");
  cachedClient = new Stripe(env.stripe.secretKey, {
    apiVersion: "2024-06-20",
  });
  return cachedClient;
};

const isStripeConfigured = () => Boolean(env.stripe.secretKey);

module.exports = {
  getStripeClient,
  isStripeConfigured,
};
