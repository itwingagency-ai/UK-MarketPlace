const ApiError = require("../lib/ApiError");

const VALID_DAYS = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm 24-hour

/**
 * Validates a single time slot object { open, close, isClosed }.
 */
const validateSlot = (slot, dayLabel = "slot") => {
  if (typeof slot !== "object" || slot === null || Array.isArray(slot)) {
    throw new ApiError(400, `${dayLabel} must be an object`);
  }
  if (slot.isClosed === true) return; // no time validation needed when closed

  if (slot.open !== undefined) {
    if (typeof slot.open !== "string" || !TIME_RE.test(slot.open)) {
      throw new ApiError(400, `${dayLabel}.open must be "HH:mm" 24-hour format (e.g. "09:00")`);
    }
  }
  if (slot.close !== undefined) {
    if (typeof slot.close !== "string" || !TIME_RE.test(slot.close)) {
      throw new ApiError(400, `${dayLabel}.close must be "HH:mm" 24-hour format (e.g. "22:00")`);
    }
  }
  // Warn if close is not after open
  if (slot.open && slot.close) {
    const [oh, om] = slot.open.split(":").map(Number);
    const [ch, cm] = slot.close.split(":").map(Number);
    const openMin  = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    if (closeMin <= openMin) {
      throw new ApiError(
        400,
        `${dayLabel}: close time (${slot.close}) must be after open time (${slot.open})`
      );
    }
  }
};

/**
 * Validates a full or partial operating hours payload.
 *
 * Accepts two forms:
 *   Array:  [{ day: "monday", open: "09:00", close: "22:00", isClosed: false }, ...]
 *   Object: { monday: { open: "09:00", close: "22:00", isClosed: false }, ... }
 *
 * @param {Array|Object} payload
 * @param {{ requireAllDays?: boolean }} options
 */
const validateOperatingHoursPayload = (payload, options = {}) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Operating hours payload must be an object or array");
  }

  const { requireAllDays = false } = options;

  // Unwrap { schedule: [...] } wrapper if present
  const data = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload.schedule) ? payload.schedule : payload);

  if (Array.isArray(data)) {
    // Array form
    if (data.length === 0) {
      throw new ApiError(400, "Operating hours schedule must not be empty");
    }
    const seenDays = new Set();
    for (const entry of data) {
      if (!entry.day || !VALID_DAYS.includes(entry.day)) {
        throw new ApiError(
          400,
          `Invalid day: "${entry.day}". Must be one of: ${VALID_DAYS.join(", ")}`
        );
      }
      if (seenDays.has(entry.day)) {
        throw new ApiError(400, `Duplicate day in schedule: "${entry.day}"`);
      }
      seenDays.add(entry.day);
      validateSlot(entry, entry.day);
    }
    if (requireAllDays) {
      for (const d of VALID_DAYS) {
        if (!seenDays.has(d)) {
          throw new ApiError(400, `Missing day in schedule: "${d}"`);
        }
      }
    }
  } else {
    // Object form: { monday: {...}, tuesday: {...} }
    for (const [day, slot] of Object.entries(data)) {
      if (!VALID_DAYS.includes(day)) {
        throw new ApiError(
          400,
          `Invalid day key: "${day}". Must be one of: ${VALID_DAYS.join(", ")}`
        );
      }
      validateSlot(slot, day);
    }
    if (requireAllDays) {
      for (const d of VALID_DAYS) {
        if (data[d] === undefined) {
          throw new ApiError(400, `Missing day in schedule: "${d}"`);
        }
      }
    }
  }
};

/**
 * Validates a day-of-week URL parameter.
 */
const validateDayKey = (day) => {
  if (!day || !VALID_DAYS.includes(day.toLowerCase())) {
    throw new ApiError(
      400,
      `Invalid day: "${day}". Must be one of: ${VALID_DAYS.join(", ")}`
    );
  }
};

module.exports = {
  validateOperatingHoursPayload,
  validateDayKey,
  VALID_DAYS,
};
