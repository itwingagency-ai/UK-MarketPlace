const ApiError = require("../lib/ApiError");

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

<<<<<<< HEAD
=======
const SHIPMENT_EVENT_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivery_attempted",
  "delivered",
  "exception",
];

// Vendors should not be able to manually push these — they're emitted by the
// system as a side effect of order-status transitions.
const SYSTEM_ONLY_SHIPMENT_STATUSES = new Set(["created", "delivered"]);

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

<<<<<<< HEAD
=======
const TRACKING_EDITABLE_FIELDS = [
  "carrier",
  "trackingNumber",
  "trackingUrl",
  "cancellationReason",
];

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
const validateOrderStatusUpdate = (currentStatus, nextStatus) => {
  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    throw new ApiError(400, "Invalid target order status");
  }

  const allowedNext = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition from ${currentStatus} to ${nextStatus}`
    );
  }
};

<<<<<<< HEAD
module.exports = {
  ALLOWED_STATUSES,
  validateOrderStatusUpdate,
=======
const validateOrderStatusPayload = (payload, currentStatus) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Invalid status update payload");
  }

  const nextStatus = payload.orderStatus;
  if (!nextStatus) {
    throw new ApiError(400, "orderStatus is required");
  }

  validateOrderStatusUpdate(currentStatus, nextStatus);

  if (payload.note !== undefined && payload.note !== null) {
    if (typeof payload.note !== "string") {
      throw new ApiError(400, "note must be a string");
    }
    if (payload.note.length > 500) {
      throw new ApiError(400, "note must be 500 characters or less");
    }
  }

  if (payload.tracking !== undefined) {
    if (
      !payload.tracking ||
      typeof payload.tracking !== "object" ||
      Array.isArray(payload.tracking)
    ) {
      throw new ApiError(400, "tracking must be an object");
    }
    for (const key of Object.keys(payload.tracking)) {
      if (!TRACKING_EDITABLE_FIELDS.includes(key)) {
        throw new ApiError(400, `tracking.${key} is not editable`);
      }
      const value = payload.tracking[key];
      if (value !== null && typeof value !== "string") {
        throw new ApiError(400, `tracking.${key} must be a string`);
      }
      if (typeof value === "string" && value.length > 500) {
        throw new ApiError(400, `tracking.${key} is too long`);
      }
    }
  }

  return { nextStatus };
};

const validateShipmentEventPayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "Invalid shipment event payload");
  }

  if (!payload.status || typeof payload.status !== "string") {
    throw new ApiError(400, "status is required");
  }
  if (!SHIPMENT_EVENT_STATUSES.includes(payload.status)) {
    throw new ApiError(
      400,
      `status must be one of: ${SHIPMENT_EVENT_STATUSES.join(", ")}`
    );
  }
  if (SYSTEM_ONLY_SHIPMENT_STATUSES.has(payload.status)) {
    throw new ApiError(
      400,
      `status "${payload.status}" is set automatically and cannot be added manually`
    );
  }

  if (payload.location !== undefined && payload.location !== null) {
    if (typeof payload.location !== "string" || payload.location.length > 200) {
      throw new ApiError(400, "location must be a string up to 200 chars");
    }
  }

  if (payload.note !== undefined && payload.note !== null) {
    if (typeof payload.note !== "string" || payload.note.length > 500) {
      throw new ApiError(400, "note must be a string up to 500 chars");
    }
  }

  if (payload.at !== undefined && payload.at !== null) {
    const d = new Date(payload.at);
    if (Number.isNaN(d.getTime())) {
      throw new ApiError(400, "at must be a valid ISO date");
    }
  }
};

module.exports = {
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
  TRACKING_EDITABLE_FIELDS,
  SHIPMENT_EVENT_STATUSES,
  SYSTEM_ONLY_SHIPMENT_STATUSES,
  validateOrderStatusUpdate,
  validateOrderStatusPayload,
  validateShipmentEventPayload,
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
};
