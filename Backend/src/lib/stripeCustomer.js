/**
 * One Stripe Customer per shopper, so PaymentSheet can offer saved cards and
 * (Wave 6) subscriptions can charge off-session. Created on first card
 * payment and stored on User.stripeCustomerId.
 */
const User = require("../models/User");
const { getStripeClient } = require("./stripeClient");

// Ephemeral keys must name the API version the server talks to Stripe with
const STRIPE_API_VERSION = "2024-06-20";

const ensureStripeCustomer = async (user) => {
  const fresh = await User.findById(user._id).select("+stripeCustomerId email name");
  if (fresh?.stripeCustomerId) return fresh.stripeCustomerId;
  const customer = await getStripeClient().customers.create(
    { email: fresh.email, name: fresh.name, metadata: { userId: String(user._id) } },
    { idempotencyKey: `customer-${user._id}` }
  );
  await User.updateOne({ _id: user._id, stripeCustomerId: { $in: ["", null] } }, { $set: { stripeCustomerId: customer.id } });
  const after = await User.findById(user._id).select("+stripeCustomerId");
  return after.stripeCustomerId || customer.id;
};

/** { customer, ephemeralKey } for PaymentSheet, or null if Stripe refuses (cards still work, just unsaved). */
const savedCardAccess = async (user) => {
  try {
    const customer = await ensureStripeCustomer(user);
    const key = await getStripeClient().ephemeralKeys.create({ customer }, { apiVersion: STRIPE_API_VERSION });
    return { customer, ephemeralKey: key.secret };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[stripe] saved cards unavailable for ${user._id}: ${err.message}`);
    return null;
  }
};

module.exports = { ensureStripeCustomer, savedCardAccess, STRIPE_API_VERSION };
