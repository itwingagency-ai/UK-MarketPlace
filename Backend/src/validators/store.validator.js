const ApiError = require("../lib/ApiError");

const validateSettingsPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Invalid settings payload");
  }

  if (payload.minimumOrder !== undefined) {
    const n = Number(payload.minimumOrder);
    if (!Number.isInteger(n) || n < 0 || n > 100000) {
      throw new ApiError(400, "minimumOrder must be whole pence between 0 and 100000 (£1,000)");
    }
  }

  if (payload.storeName !== undefined) {
    const name = payload.storeName.trim();
    if (name.length > 120) {
      throw new ApiError(400, "storeName must be 120 characters or less");
    }
  }
};

module.exports = {
  validateSettingsPayload,
};
