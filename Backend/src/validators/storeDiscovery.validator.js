const ApiError = require("../lib/ApiError");
const { isValidLatLng } = require("../lib/geoUtils");

// ── Store Discovery Query Validator ──────────────────────────────────────────

/**
 * Validates the query params for GET /api/v1/stores/nearby
 *
 * Accepted forms:
 *   ?address=EH1+1AA              → geocoded via Google Maps
 *   ?lat=55.95&lng=-3.19          → raw coordinates (skip geocoding)
 *   ?address=...&radius=10        → optional custom radius cap (km)
 *   ?address=...&limit=20&page=1  → pagination
 */
const validateNearbyQuery = (query) => {
  const { address, lat, lng, radius, limit, page } = query;

  const hasAddress = address && String(address).trim().length > 0;
  const hasLatLng  = lat !== undefined && lng !== undefined;

  if (!hasAddress && !hasLatLng) {
    throw new ApiError(
      400,
      "Provide either 'address' (postcode or street) or both 'lat' and 'lng'"
    );
  }

  if (hasLatLng && !isValidLatLng(lat, lng)) {
    throw new ApiError(
      400,
      "'lat' must be -90 to 90 and 'lng' must be -180 to 180"
    );
  }

  if (radius !== undefined) {
    const r = Number(radius);
    if (Number.isNaN(r) || r < 0.1 || r > 100) {
      throw new ApiError(400, "'radius' must be a number between 0.1 and 100 km");
    }
  }

  if (limit !== undefined) {
    const l = Number(limit);
    if (!Number.isInteger(l) || l < 1 || l > 50) {
      throw new ApiError(400, "'limit' must be an integer between 1 and 50");
    }
  }

  if (page !== undefined) {
    const p = Number(page);
    if (!Number.isInteger(p) || p < 1) {
      throw new ApiError(400, "'page' must be a positive integer");
    }
  }
};

// ── Store Location Update Validator ──────────────────────────────────────────

/**
 * Validates the body for PATCH /api/v1/vendor/dashboard/settings/location
 * or equivalent admin endpoint.
 *
 * Accepted forms:
 *   { address: "EH1 1AA" }                        → geocode on server
 *   { lat: 55.95, lng: -3.19 }                    → direct coordinates
 *   { lat: 55.95, lng: -3.19, deliveryRadiusKm: 8 }
 *   { deliveryRadiusKm: 8 }                       → update radius only
 *   { operatingHours: { monday: { open:"09:00", close:"22:00", isClosed:false } } }
 */
const validateStoreLocationUpdate = (body) => {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "Invalid request body");
  }

  const { address, lat, lng, deliveryRadiusKm, operatingHours } = body;

  const hasAddress = address !== undefined;
  const hasLat     = lat !== undefined;
  const hasLng     = lng !== undefined;

  // Must provide at least one field to update
  const hasAnything =
    hasAddress || hasLat || hasLng ||
    deliveryRadiusKm !== undefined ||
    operatingHours !== undefined;

  if (!hasAnything) {
    throw new ApiError(
      400,
      "Provide at least one field: address, lat/lng, deliveryRadiusKm, or operatingHours"
    );
  }

  // If supplying coordinates, both are required
  if (hasLat !== hasLng) {
    throw new ApiError(400, "Both 'lat' and 'lng' are required together");
  }

  if (hasLat && hasLng && !isValidLatLng(lat, lng)) {
    throw new ApiError(
      400,
      "'lat' must be -90 to 90 and 'lng' must be -180 to 180"
    );
  }

  if (deliveryRadiusKm !== undefined) {
    const r = Number(deliveryRadiusKm);
    if (Number.isNaN(r) || r < 0.1 || r > 100) {
      throw new ApiError(
        400,
        "'deliveryRadiusKm' must be a number between 0.1 and 100"
      );
    }
  }

  if (operatingHours !== undefined) {
    if (typeof operatingHours !== "object" || Array.isArray(operatingHours)) {
      throw new ApiError(400, "'operatingHours' must be an object");
    }

    const VALID_DAYS = [
      "monday", "tuesday", "wednesday", "thursday",
      "friday", "saturday", "sunday",
    ];
    const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm 24-hour

    for (const [day, slot] of Object.entries(operatingHours)) {
      if (!VALID_DAYS.includes(day)) {
        throw new ApiError(400, `Invalid day key in operatingHours: '${day}'`);
      }
      if (typeof slot !== "object" || slot === null) {
        throw new ApiError(400, `operatingHours.${day} must be an object`);
      }
      if (slot.open !== undefined && !TIME_RE.test(slot.open)) {
        throw new ApiError(
          400,
          `operatingHours.${day}.open must be "HH:mm" 24-hour format`
        );
      }
      if (slot.close !== undefined && !TIME_RE.test(slot.close)) {
        throw new ApiError(
          400,
          `operatingHours.${day}.close must be "HH:mm" 24-hour format`
        );
      }
    }
  }
};

module.exports = {
  validateNearbyQuery,
  validateStoreLocationUpdate,
};
