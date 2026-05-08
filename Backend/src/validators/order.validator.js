const ApiError = require("../lib/ApiError");

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

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

module.exports = {
  ALLOWED_STATUSES,
  validateOrderStatusUpdate,
};
