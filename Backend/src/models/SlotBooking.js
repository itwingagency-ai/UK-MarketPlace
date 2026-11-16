const mongoose = require("mongoose");

/**
 * Orders booked into one store time slot (both methods share the store's
 * picking capacity). Claimed with a conditional upsert at checkout so a full
 * slot can't be overbooked; released when a booked order is cancelled.
 */
const slotBookingSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    slotStart: { type: Date, required: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

slotBookingSchema.index({ store: 1, slotStart: 1 }, { unique: true });

module.exports = mongoose.model("SlotBooking", slotBookingSchema);
