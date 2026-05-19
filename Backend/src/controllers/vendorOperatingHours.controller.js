/**
 * vendorOperatingHours.controller.js
 *
 * Dedicated controller for managing store operating hours.
 * Separated from vendorLocation so vendors can update hours without
 * touching their delivery coordinates.
 *
 * Routes (mounted under /api/v1/vendor/dashboard):
 *   GET    /operating-hours            — full week schedule + live status
 *   PUT    /operating-hours            — replace full week schedule
 *   PATCH  /operating-hours/:day       — update a single day
 *   DELETE /operating-hours/:day       — mark a day as closed (isClosed=true)
 *   GET    /operating-hours/status     — live open/closed status (for dashboard widget)
 */

const asyncHandler = require("../lib/asyncHandler");
const ApiError = require("../lib/ApiError");
const { computeOpenStatus } = require("../lib/geoUtils");
const { validateOperatingHoursPayload, validateDayKey } = require("../validators/operatingHours.validator");
const Store = require("../models/Store");

const DAYS = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const resolveStore = async (req) => {
  const storeId = req.storeScopeId;
  if (!storeId) throw new ApiError(400, "No store in scope");
  const store = await Store.findById(storeId).select(
    "name operatingHours timezone"
  );
  if (!store) throw new ApiError(404, "Store not found");
  return store;
};

const formatScheduleForResponse = (operatingHours) => {
  // Normalise Map or plain object → consistent array output
  return DAYS.map((day) => {
    const slot =
      operatingHours instanceof Map
        ? operatingHours.get(day)
        : (operatingHours || {})[day];
    return {
      day,
      open:     slot?.open     || null,
      close:    slot?.close    || null,
      isClosed: slot?.isClosed ?? true,
    };
  });
};

// ── GET /operating-hours ──────────────────────────────────────────────────────

const getOperatingHours = asyncHandler(async (req, res) => {
  const store = await resolveStore(req);
  const timezone = store.timezone || req.query.timezone || "UTC";

  const status = computeOpenStatus(store.operatingHours, timezone);

  res.status(200).json({
    data: {
      schedule: formatScheduleForResponse(store.operatingHours),
      liveStatus: {
        isOpen:            status.isOpen,
        statusLabel:       status.statusLabel,
        todayDay:          status.todayDay,
        opensAt:           status.opensAt,
        closesAt:          status.closesAt,
        minutesUntilOpen:  status.minutesUntilOpen,
        minutesUntilClose: status.minutesUntilClose,
        nextOpenDay:       status.nextOpenDay,
        nextOpenTime:      status.nextOpenTime,
      },
      timezone,
    },
  });
});

// ── GET /operating-hours/status ───────────────────────────────────────────────
// Lightweight endpoint for the dashboard "live widget" — minimal DB read

const getLiveStatus = asyncHandler(async (req, res) => {
  const store = await resolveStore(req);
  const timezone = store.timezone || req.query.timezone || "UTC";
  const status = computeOpenStatus(store.operatingHours, timezone);

  res.status(200).json({
    data: {
      isOpen:            status.isOpen,
      statusLabel:       status.statusLabel,
      todayDay:          status.todayDay,
      todayHours:        status.todayHours,
      opensAt:           status.opensAt,
      closesAt:          status.closesAt,
      minutesUntilOpen:  status.minutesUntilOpen,
      minutesUntilClose: status.minutesUntilClose,
      nextOpenDay:       status.nextOpenDay,
      nextOpenTime:      status.nextOpenTime,
      weekSchedule:      status.weekSchedule,
      timezone,
      asOf:              new Date().toISOString(),
    },
  });
});

// ── PUT /operating-hours ──────────────────────────────────────────────────────
// Replace the entire weekly schedule in one request.

const replaceOperatingHours = asyncHandler(async (req, res) => {
  validateOperatingHoursPayload(req.body, { requireAllDays: false });
  const store = await resolveStore(req);

  // Build a fresh Map from the payload.
  // Unmentioned days are left as-is (vendor can send partial week).
  const currentHours = store.operatingHours || new Map();
  const incoming = req.body.schedule || req.body; // support { schedule: [...] } or flat { monday: {...} }

  const applySlot = (day, slot) => {
    if (currentHours.set) {
      currentHours.set(day, { open: slot.open, close: slot.close, isClosed: !!slot.isClosed });
    } else {
      currentHours[day] = { open: slot.open, close: slot.close, isClosed: !!slot.isClosed };
    }
  };

  if (Array.isArray(incoming)) {
    // [{ day, open, close, isClosed }]
    for (const entry of incoming) {
      applySlot(entry.day, entry);
    }
  } else {
    // { monday: { open, close, isClosed }, tuesday: ... }
    for (const day of DAYS) {
      if (incoming[day] !== undefined) {
        applySlot(day, incoming[day]);
      }
    }
  }

  store.operatingHours = currentHours;
  await store.save();

  res.status(200).json({
    message: "Operating hours updated",
    data: { schedule: formatScheduleForResponse(store.operatingHours) },
  });
});

// ── PATCH /operating-hours/:day ───────────────────────────────────────────────
// Update a single day without touching the rest.

const updateDay = asyncHandler(async (req, res) => {
  const { day } = req.params;
  validateDayKey(day);

  const { open, close, isClosed } = req.body;
  if (open === undefined && close === undefined && isClosed === undefined) {
    throw new ApiError(400, "Provide at least one of: open, close, isClosed");
  }

  const store = await resolveStore(req);
  const currentHours = store.operatingHours || new Map();

  const existing =
    currentHours instanceof Map
      ? (currentHours.get(day) || {})
      : (currentHours[day] || {});

  const updated = {
    open:     open     !== undefined ? open     : (existing.open     || "09:00"),
    close:    close    !== undefined ? close    : (existing.close    || "22:00"),
    isClosed: isClosed !== undefined ? !!isClosed : (existing.isClosed ?? false),
  };

  // Validate time strings if provided
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (updated.open  && !TIME_RE.test(updated.open))  throw new ApiError(400, "open must be HH:mm");
  if (updated.close && !TIME_RE.test(updated.close)) throw new ApiError(400, "close must be HH:mm");

  if (currentHours.set) {
    currentHours.set(day, updated);
  } else {
    currentHours[day] = updated;
  }

  store.operatingHours = currentHours;
  await store.save();

  res.status(200).json({
    message: `${day.charAt(0).toUpperCase() + day.slice(1)} hours updated`,
    data: { day, ...updated },
  });
});

// ── DELETE /operating-hours/:day ──────────────────────────────────────────────
// Mark a specific day as closed (sets isClosed: true, preserves time values).

const closeDay = asyncHandler(async (req, res) => {
  const { day } = req.params;
  validateDayKey(day);

  const store = await resolveStore(req);
  const currentHours = store.operatingHours || new Map();

  const existing =
    currentHours instanceof Map
      ? (currentHours.get(day) || {})
      : (currentHours[day] || {});

  const updated = { ...existing, isClosed: true };

  if (currentHours.set) {
    currentHours.set(day, updated);
  } else {
    currentHours[day] = updated;
  }

  store.operatingHours = currentHours;
  await store.save();

  res.status(200).json({
    message: `${day.charAt(0).toUpperCase() + day.slice(1)} marked as closed`,
    data: { day, isClosed: true },
  });
});

module.exports = {
  getOperatingHours,
  getLiveStatus,
  replaceOperatingHours,
  updateDay,
  closeDay,
};
