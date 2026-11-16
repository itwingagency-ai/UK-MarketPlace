const mongoose = require("mongoose");

/**
 * A repeat order: the same items from one store on a schedule.
 *
 * Dates are calendar days in the store's timezone ("YYYY-MM-DD"). The
 * scheduler (lib/subscriptions) places the order on nextRunOn through the
 * normal checkout code, then moves nextRunOn on. A failed run is retried the
 * next day; after 3 failures in a row the subscription pauses itself.
 *
 * Card repeat orders charge a card saved for off-session use (SetupIntent);
 * the card number never touches our servers.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    items: {
      type: [
        new mongoose.Schema(
          {
            product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
            variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
            title: { type: String, default: "" },
            quantity: { type: Number, required: true, min: 1, max: 99 },
          },
          { _id: false }
        ),
      ],
      validate: [(a) => Array.isArray(a) && a.length > 0 && a.length <= 50, "A repeat order needs 1-50 items"],
    },
    cadence: {
      every: { type: String, enum: ["week", "fortnight", "month"], required: true },
      weekday: { type: Number, min: 0, max: 6, default: null }, // 0 = Sunday (week / fortnight)
      dayOfMonth: { type: Number, min: 1, max: 28, default: null }, // month
    },
    nextRunOn: { type: String, required: true, index: true }, // YYYY-MM-DD, store's timezone
    skipDates: { type: [String], default: [] },
    method: { type: String, enum: ["delivery", "collection"], default: "delivery" },
    preferredTime: { type: String, default: "", match: /^$|^([01]\d|2[0-3]):[0-5]\d$/ }, // slot start, if the store has slots
    shippingAddress: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      lat: Number,
      lng: Number,
    },
    note: { type: String, default: "", maxlength: 500 },
    allowSubstitutions: { type: Boolean, default: true },
    ageConfirmed: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ["cod", "card"], required: true },
    stripePaymentMethodId: { type: String, default: "" },
    cardLabel: { type: String, default: "" }, // e.g. "VISA •••• 4242"
    status: { type: String, enum: ["active", "paused", "cancelled"], default: "active", index: true },
    pausedReason: { type: String, default: "" },
    failures: { type: Number, default: 0 },
    lastRunOn: { type: String, default: "" },
    lastRunAt: { type: Date, default: null },
    lastOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    lastResult: { ok: Boolean, message: String },
    // Claimed by one scheduler run at a time
    runningSince: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
