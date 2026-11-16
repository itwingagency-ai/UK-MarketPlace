const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");

const isPlainObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** PUT /cart/fulfilment { storeId, method, slotStart } — slotStart null = ASAP */
const validateCartFulfilmentPayload = (payload) => {
  if (!isPlainObject(payload)) throw new ApiError(400, "Invalid fulfilment payload");
  if (!mongoose.Types.ObjectId.isValid(payload.storeId)) throw new ApiError(400, "valid storeId is required");
  if (!["delivery", "collection"].includes(payload.method)) {
    throw new ApiError(400, "method must be delivery or collection");
  }
  if (payload.slotStart !== undefined && payload.slotStart !== null) {
    if (typeof payload.slotStart !== "string" || Number.isNaN(new Date(payload.slotStart).getTime())) {
      throw new ApiError(400, "slotStart must be a date-time, or null for as soon as possible");
    }
  }
};

/** PATCH /vendor/dashboard/fulfilment */
const validateFulfilmentSettings = (payload) => {
  if (!isPlainObject(payload)) throw new ApiError(400, "Invalid fulfilment settings");
  for (const flag of ["deliveryEnabled", "collectionEnabled"]) {
    if (payload[flag] !== undefined && typeof payload[flag] !== "boolean") {
      throw new ApiError(400, `${flag} must be true or false`);
    }
  }
  const ranges = {
    slotLengthMins: [15, 240],
    leadTimeMins: [0, 1440],
    maxOrdersPerSlot: [0, 1000],
    daysAhead: [0, 14],
  };
  for (const [field, [min, max]] of Object.entries(ranges)) {
    if (payload[field] === undefined) continue;
    if (!Number.isInteger(payload[field]) || payload[field] < min || payload[field] > max) {
      throw new ApiError(400, `${field} must be a whole number from ${min} to ${max}`);
    }
  }
  if (payload.collectionInstructions !== undefined) {
    if (typeof payload.collectionInstructions !== "string" || payload.collectionInstructions.length > 300) {
      throw new ApiError(400, "collectionInstructions must be 300 characters or less");
    }
  }
  if (payload.deliveryEnabled === false && payload.collectionEnabled === false) {
    throw new ApiError(400, "Offer at least one of delivery or collection");
  }
};

module.exports = { validateCartFulfilmentPayload, validateFulfilmentSettings };
