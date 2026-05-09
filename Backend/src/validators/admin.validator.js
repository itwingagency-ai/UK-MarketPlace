const ApiError = require("../lib/ApiError");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const ALLOWED_USER_ROLES = ["admin", "vendor", "customer"];
const ALLOWED_USER_STATUSES = ["active", "suspended"];
const ALLOWED_STORE_STATUSES = ["active", "suspended"];

const validateAdminUserUpdate = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid update payload");
  }

  if (payload.email !== undefined || payload.password !== undefined) {
    throw new ApiError(400, "email and password cannot be changed via this endpoint");
  }

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || payload.name.trim().length < 2) {
      throw new ApiError(400, "name must be at least 2 characters");
    }
    if (payload.name.trim().length > 80) {
      throw new ApiError(400, "name must be 80 characters or less");
    }
  }

  if (payload.phone !== undefined && payload.phone !== null) {
    if (typeof payload.phone !== "string") {
      throw new ApiError(400, "phone must be a string");
    }
    if (payload.phone.length > 30) {
      throw new ApiError(400, "phone must be 30 characters or less");
    }
  }

  if (payload.status !== undefined) {
    if (!ALLOWED_USER_STATUSES.includes(payload.status)) {
      throw new ApiError(
        400,
        `status must be one of: ${ALLOWED_USER_STATUSES.join(", ")}`
      );
    }
  }

  if (payload.role !== undefined) {
    if (!ALLOWED_USER_ROLES.includes(payload.role)) {
      throw new ApiError(
        400,
        `role must be one of: ${ALLOWED_USER_ROLES.join(", ")}`
      );
    }
  }
};

const validateAdminStoreUpdate = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid update payload");
  }

  if (payload.owner !== undefined || payload.slug !== undefined) {
    throw new ApiError(
      400,
      "owner and slug cannot be changed via this endpoint"
    );
  }

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || payload.name.trim().length < 2) {
      throw new ApiError(400, "name must be at least 2 characters");
    }
    if (payload.name.trim().length > 120) {
      throw new ApiError(400, "name must be 120 characters or less");
    }
  }

  if (payload.status !== undefined) {
    if (!ALLOWED_STORE_STATUSES.includes(payload.status)) {
      throw new ApiError(
        400,
        `status must be one of: ${ALLOWED_STORE_STATUSES.join(", ")}`
      );
    }
  }

  if (payload.commissionRate !== undefined && payload.commissionRate !== null) {
    const n = Number(payload.commissionRate);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      throw new ApiError(
        400,
        "commissionRate must be a number between 0 and 1 (e.g. 0.10 = 10%)"
      );
    }
  }

  const stringFields = {
    "contact.phone": 30,
    "contact.email": 120,
    "address.line1": 200,
    "address.line2": 200,
    "address.city": 80,
    "address.state": 80,
    "address.postalCode": 20,
    "address.country": 80,
  };

  const getNested = (obj, path) => {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  };

  for (const [path, max] of Object.entries(stringFields)) {
    const value = getNested(payload, path);
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") {
      throw new ApiError(400, `${path} must be a string`);
    }
    if (value.length > max) {
      throw new ApiError(400, `${path} is too long (max ${max})`);
    }
  }
};

const validatePlatformSettingsUpdate = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid settings payload");
  }

  if (payload.key !== undefined) {
    throw new ApiError(400, "key cannot be modified");
  }

  if (payload.platformName !== undefined) {
    if (
      typeof payload.platformName !== "string" ||
      payload.platformName.trim().length < 2 ||
      payload.platformName.trim().length > 120
    ) {
      throw new ApiError(400, "platformName must be 2-120 characters");
    }
  }

  if (payload.supportEmail !== undefined && payload.supportEmail !== null) {
    if (
      typeof payload.supportEmail !== "string" ||
      payload.supportEmail.length > 120
    ) {
      throw new ApiError(400, "supportEmail must be a string up to 120 chars");
    }
  }

  if (payload.supportPhone !== undefined && payload.supportPhone !== null) {
    if (
      typeof payload.supportPhone !== "string" ||
      payload.supportPhone.length > 30
    ) {
      throw new ApiError(400, "supportPhone must be a string up to 30 chars");
    }
  }

  if (payload.currency !== undefined) {
    if (
      typeof payload.currency !== "string" ||
      payload.currency.length < 3 ||
      payload.currency.length > 5
    ) {
      throw new ApiError(400, "currency must be a 3-5 char ISO code");
    }
  }

  if (payload.commission !== undefined) {
    if (!isPlainObject(payload.commission)) {
      throw new ApiError(400, "commission must be an object");
    }
    if (payload.commission.type !== undefined) {
      if (!["percentage", "fixed"].includes(payload.commission.type)) {
        throw new ApiError(
          400,
          'commission.type must be "percentage" or "fixed"'
        );
      }
    }
    if (payload.commission.defaultRate !== undefined) {
      const n = Number(payload.commission.defaultRate);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        throw new ApiError(
          400,
          "commission.defaultRate must be between 0 and 1"
        );
      }
    }
    if (payload.commission.defaultFixed !== undefined) {
      const n = Number(payload.commission.defaultFixed);
      if (Number.isNaN(n) || n < 0) {
        throw new ApiError(
          400,
          "commission.defaultFixed must be a non-negative number"
        );
      }
    }
  }

  if (payload.policies !== undefined && !isPlainObject(payload.policies)) {
    throw new ApiError(400, "policies must be an object");
  }
  if (payload.features !== undefined && !isPlainObject(payload.features)) {
    throw new ApiError(400, "features must be an object");
  }
};

const validateStoreCommissionPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid commission payload");
  }

  // Legacy form: { commissionRate: 0..1 | null }
  if (payload.commissionRate !== undefined) {
    if (payload.commissionRate !== null) {
      const n = Number(payload.commissionRate);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        throw new ApiError(
          400,
          "commissionRate must be a number between 0 and 1, or null"
        );
      }
    }
  }

  // New form: { type, rate?, fixed? } where type may be null to clear
  if (payload.type !== undefined && payload.type !== null) {
    if (!["percentage", "fixed"].includes(payload.type)) {
      throw new ApiError(
        400,
        'type must be "percentage", "fixed", or null to clear override'
      );
    }
    if (payload.type === "percentage") {
      if (payload.rate === undefined || payload.rate === null) {
        throw new ApiError(
          400,
          "rate is required when type is 'percentage'"
        );
      }
      const n = Number(payload.rate);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        throw new ApiError(400, "rate must be between 0 and 1");
      }
    }
    if (payload.type === "fixed") {
      if (payload.fixed === undefined || payload.fixed === null) {
        throw new ApiError(
          400,
          "fixed is required when type is 'fixed'"
        );
      }
      const n = Number(payload.fixed);
      if (Number.isNaN(n) || n < 0) {
        throw new ApiError(400, "fixed must be a non-negative number");
      }
    }
  }

  if (
    payload.commissionRate === undefined &&
    payload.type === undefined
  ) {
    throw new ApiError(
      400,
      "Provide either { commissionRate } or { type, rate?, fixed? }"
    );
  }
};

module.exports = {
  ALLOWED_USER_ROLES,
  ALLOWED_USER_STATUSES,
  ALLOWED_STORE_STATUSES,
  validateAdminUserUpdate,
  validateAdminStoreUpdate,
  validatePlatformSettingsUpdate,
  validateStoreCommissionPayload,
};
