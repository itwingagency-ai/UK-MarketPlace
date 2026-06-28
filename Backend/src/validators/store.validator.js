const ApiError = require("../lib/ApiError");

const validateSettingsPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Invalid settings payload");
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
