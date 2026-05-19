/**
 * geoUtils.js
 *
 * Utilities for:
 *  - Geocoding an address / postcode → { lat, lng } via Google Maps Geocoding API
 *  - Building MongoDB $nearSphere / $geoWithin query fragments
 *  - Distance helpers
 *
 * The Google Maps Geocoding API works for any country and any address format
 * (postcodes, street addresses, city names, landmarks, etc.).
 *
 * Usage:
 *   const { geocodeAddress } = require("../lib/geoUtils");
 *   const { lat, lng, formattedAddress } = await geocodeAddress("EH1 1AA");
 */

const https = require("https");
const env = require("../config/env");
const ApiError = require("./ApiError");

// ── Constants ─────────────────────────────────────────────────────────────────
const EARTH_RADIUS_KM = 6371;
const GOOGLE_GEOCODE_BASE =
  "https://maps.googleapis.com/maps/api/geocode/json";

// ── Google Maps Geocoding ─────────────────────────────────────────────────────

/**
 * Fetch JSON from a URL using Node's built-in https module.
 * Keeps the runtime dependency count at zero (no axios / node-fetch needed).
 */
const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(new Error("Failed to parse geocoding response")); }
        });
      })
      .on("error", reject);
  });

/**
 * Geocode any address string (postcode, street, city…) via Google Maps API.
 *
 * @param {string} address - Human-readable address or postcode
 * @returns {{ lat: number, lng: number, formattedAddress: string }}
 * @throws ApiError 400 if the address cannot be geocoded
 * @throws ApiError 503 if Google API key is missing or API call fails
 */
const geocodeAddress = async (address) => {
  const apiKey = env.googleMapsApiKey;
  if (!apiKey) {
    throw new ApiError(
      503,
      "Geocoding is not configured on this server (missing GOOGLE_MAPS_API_KEY)"
    );
  }

  const encodedAddress = encodeURIComponent(address.trim());
  const url = `${GOOGLE_GEOCODE_BASE}?address=${encodedAddress}&key=${apiKey}`;

  let data;
  try {
    data = await fetchJson(url);
  } catch (err) {
    throw new ApiError(503, "Geocoding service unavailable. Please try again.");
  }

  if (data.status === "REQUEST_DENIED") {
    throw new ApiError(503, "Geocoding API key is invalid or restricted.");
  }

  if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
    throw new ApiError(400, `Address not found: "${address}"`);
  }

  if (data.status !== "OK") {
    throw new ApiError(503, `Geocoding failed with status: ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  const formattedAddress = data.results[0].formatted_address;

  return { lat, lng, formattedAddress };
};

// ── Coordinate Validation ─────────────────────────────────────────────────────

/**
 * Validates that lat and lng are within geographic bounds.
 */
const isValidLatLng = (lat, lng) => {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    !Number.isNaN(la) && !Number.isNaN(ln) &&
    la >= -90  && la <= 90 &&
    ln >= -180 && ln <= 180
  );
};

// ── MongoDB Geo Query Builders ────────────────────────────────────────────────

/**
 * Build a MongoDB $nearSphere query for the `location` field.
 * Returns stores sorted nearest → furthest automatically (MongoDB behaviour).
 *
 * @param {number} lng  - Longitude
 * @param {number} lat  - Latitude
 * @param {number} maxKm - Maximum search radius in kilometres
 * @returns {object} MongoDB query fragment: { location: { $nearSphere: … } }
 */
const buildNearQuery = (lng, lat, maxKm) => ({
  location: {
    $nearSphere: {
      $geometry: { type: "Point", coordinates: [lng, lat] },
      $maxDistance: maxKm * 1000, // metres
    },
  },
});

/**
 * Build a $geoWithin (no sort) alternative — useful for counting stores
 * in an area without triggering the "cannot combine $nearSphere with $or" limit.
 *
 * @param {number} lng
 * @param {number} lat
 * @param {number} radiusKm
 * @returns {object} MongoDB query fragment: { location: { $geoWithin: … } }
 */
const buildWithinQuery = (lng, lat, radiusKm) => ({
  location: {
    $geoWithin: {
      $centerSphere: [[lng, lat], radiusKm / EARTH_RADIUS_KM],
    },
  },
});

// ── Distance Computation ──────────────────────────────────────────────────────

/**
 * Haversine formula — computes the great-circle distance between two points.
 * Used to annotate the result set with human-readable distances.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in kilometres (rounded to 2 dp)
 */
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
};

// ── Operating Hours ───────────────────────────────────────────────────────────

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

const DAY_DISPLAY = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

/**
 * Parse "HH:mm" → total minutes since midnight.
 */
const toMinutes = (timeStr) => {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return h * 60 + m;
};

/**
 * Format minutes since midnight → "9:00 AM" / "10:30 PM"
 */
const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

/**
 * Format a minute duration into a human string: "2h 30m" / "45 min"
 */
const formatDuration = (minutes) => {
  if (minutes <= 0) return "now";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * Get the slot for a given day from a Map or plain object.
 */
const getSlot = (operatingHours, dayName) =>
  operatingHours instanceof Map
    ? operatingHours.get(dayName)
    : (operatingHours || {})[dayName];

/**
 * Compute rich open/closed status for a store.
 *
 * @param {Map|Object} operatingHours  - store.operatingHours
 * @param {string}     [timezone="UTC"] - IANA timezone (e.g. "Europe/London")
 * @returns {{
 *   isOpen:            boolean|null,
 *   statusLabel:       string,        // "Open", "Closed", "Opens at 9:00 AM", "Closes at 10:00 PM"
 *   todayDay:          string,        // "monday"
 *   todayHours:        object|null,   // { open, close, isClosed }
 *   minutesUntilOpen:  number|null,
 *   minutesUntilClose: number|null,
 *   opensAt:           string|null,   // formatted time e.g. "9:00 AM"
 *   closesAt:          string|null,
 *   nextOpenDay:       string|null,   // "Tomorrow" or "Wednesday"
 *   nextOpenTime:      string|null,
 *   weekSchedule:      Array          // full week for UI display
 * }}
 */
const computeOpenStatus = (operatingHours, timezone = "UTC") => {
  if (!operatingHours) {
    return {
      isOpen: null, statusLabel: "Hours not set",
      todayDay: null, todayHours: null,
      minutesUntilOpen: null, minutesUntilClose: null,
      opensAt: null, closesAt: null,
      nextOpenDay: null, nextOpenTime: null,
      weekSchedule: [],
    };
  }

  // Current time in the store's timezone
  const now = new Date();
  const localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const todayIdx = localNow.getDay(); // 0 = Sunday
  const todayName = DAY_NAMES[todayIdx];
  const currentMinutes = localNow.getHours() * 60 + localNow.getMinutes();

  const todaySlot = getSlot(operatingHours, todayName);

  // Build full week schedule for frontend display
  const weekSchedule = DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map((day) => {
    // Start week on Monday
    const slot = getSlot(operatingHours, day);
    return {
      day,
      displayName: DAY_DISPLAY[day],
      open: slot?.open || null,
      close: slot?.close || null,
      isClosed: slot?.isClosed ?? (slot == null),
      isToday: day === todayName,
    };
  });

  // Today has no hours configured → treat as closed
  if (!todaySlot || todaySlot.isClosed) {
    const next = findNextOpenDay(operatingHours, todayIdx);
    return {
      isOpen: false,
      statusLabel: next
        ? `Closed · Opens ${next.label} at ${next.time}`
        : "Closed",
      todayDay: todayName,
      todayHours: todaySlot || null,
      minutesUntilOpen: null,
      minutesUntilClose: null,
      opensAt: null,
      closesAt: null,
      nextOpenDay: next?.label || null,
      nextOpenTime: next?.time || null,
      weekSchedule,
    };
  }

  const openMin  = toMinutes(todaySlot.open);
  const closeMin = toMinutes(todaySlot.close);
  const closesAt = formatTime(closeMin);
  const opensAt  = formatTime(openMin);

  // Currently open
  if (currentMinutes >= openMin && currentMinutes < closeMin) {
    const minutesUntilClose = closeMin - currentMinutes;
    const closingSoon = minutesUntilClose <= 30;
    return {
      isOpen: true,
      statusLabel: closingSoon
        ? `Closes soon · ${formatDuration(minutesUntilClose)}`
        : `Open · Closes at ${closesAt}`,
      todayDay: todayName,
      todayHours: todaySlot,
      minutesUntilOpen: null,
      minutesUntilClose,
      opensAt,
      closesAt,
      nextOpenDay: null,
      nextOpenTime: null,
      weekSchedule,
    };
  }

  // Before opening today
  if (currentMinutes < openMin) {
    const minutesUntilOpen = openMin - currentMinutes;
    return {
      isOpen: false,
      statusLabel: `Opens at ${opensAt} · ${formatDuration(minutesUntilOpen)}`,
      todayDay: todayName,
      todayHours: todaySlot,
      minutesUntilOpen,
      minutesUntilClose: null,
      opensAt,
      closesAt,
      nextOpenDay: "Today",
      nextOpenTime: opensAt,
      weekSchedule,
    };
  }

  // After closing today — find next open day
  const next = findNextOpenDay(operatingHours, todayIdx);
  return {
    isOpen: false,
    statusLabel: next
      ? `Closed · Opens ${next.label} at ${next.time}`
      : "Closed",
    todayDay: todayName,
    todayHours: todaySlot,
    minutesUntilOpen: null,
    minutesUntilClose: null,
    opensAt,
    closesAt,
    nextOpenDay: next?.label || null,
    nextOpenTime: next?.time || null,
    weekSchedule,
  };
};

/**
 * Find the next day (after today) that has open hours configured.
 * Looks up to 7 days ahead.
 */
const findNextOpenDay = (operatingHours, todayDayIdx) => {
  for (let i = 1; i <= 7; i++) {
    const idx = (todayDayIdx + i) % 7;
    const dayName = DAY_NAMES[idx];
    const slot = getSlot(operatingHours, dayName);
    if (slot && !slot.isClosed && slot.open) {
      const label = i === 1 ? "Tomorrow" : DAY_DISPLAY[dayName];
      return { label, time: formatTime(toMinutes(slot.open)) };
    }
  }
  return null;
};

/**
 * Backward-compatible alias for code that uses getOpenStatus.
 * Returns { isOpen, todayHours } subset.
 */
const getOpenStatus = (operatingHours, timezone = "UTC") => {
  const status = computeOpenStatus(operatingHours, timezone);
  return { isOpen: status.isOpen, todayHours: status.todayHours };
};

module.exports = {
  geocodeAddress,
  isValidLatLng,
  buildNearQuery,
  buildWithinQuery,
  haversineKm,
  getOpenStatus,
  computeOpenStatus,
};
