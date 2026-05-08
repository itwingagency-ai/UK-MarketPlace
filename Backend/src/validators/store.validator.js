const ApiError = require("../lib/ApiError");

const validateSettingsPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Invalid settings payload");
  }

  if (payload.branding && payload.branding.displayName !== undefined) {
    const name = payload.branding.displayName.trim();
    if (name.length > 120) {
      throw new ApiError(400, "branding.displayName must be 120 characters or less");
    }
  }
};

module.exports = {
  validateSettingsPayload,
};
