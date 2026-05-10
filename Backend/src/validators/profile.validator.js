const ApiError = require("../lib/ApiError");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const FORBIDDEN_PROFILE_FIELDS = ["email", "role", "status", "storeId", "password"];

const validateProfileUpdate = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid profile payload");
  }

  for (const field of FORBIDDEN_PROFILE_FIELDS) {
    if (payload[field] !== undefined) {
      throw new ApiError(
        400,
        `${field} cannot be changed via this endpoint`
      );
    }
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
    if (payload.phone.trim().length > 30) {
      throw new ApiError(400, "phone must be 30 characters or less");
    }
  }
};

const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const validatePasswordChange = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid password payload");
  }
  if (
    !payload.currentPassword ||
    typeof payload.currentPassword !== "string"
  ) {
    throw new ApiError(400, "currentPassword is required");
  }
  if (!payload.newPassword || typeof payload.newPassword !== "string") {
    throw new ApiError(400, "newPassword is required");
  }
  if (payload.newPassword.length < 8) {
    throw new ApiError(400, "newPassword must be at least 8 characters");
  }
  if (!PASSWORD_COMPLEXITY.test(payload.newPassword)) {
    throw new ApiError(
      400,
      "newPassword must contain upper, lower and numeric characters"
    );
  }
  if (payload.newPassword === payload.currentPassword) {
    throw new ApiError(
      400,
      "newPassword must be different from currentPassword"
    );
  }
};

const ADDRESS_STRING_LIMITS = {
  label: 40,
  fullName: 80,
  phone: 30,
  line1: 200,
  line2: 200,
  city: 80,
  state: 80,
  postalCode: 20,
  country: 80,
};

const validateAddressPayload = (payload, isPatch = false) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid address payload");
  }

  const required = ["line1", "city"];
  if (!isPatch) {
    for (const field of required) {
      if (
        !payload[field] ||
        typeof payload[field] !== "string" ||
        payload[field].trim().length < 2
      ) {
        throw new ApiError(400, `${field} is required`);
      }
    }
  } else {
    for (const field of required) {
      if (payload[field] !== undefined) {
        if (
          typeof payload[field] !== "string" ||
          payload[field].trim().length < 2
        ) {
          throw new ApiError(400, `${field} must be at least 2 characters`);
        }
      }
    }
  }

  for (const [field, max] of Object.entries(ADDRESS_STRING_LIMITS)) {
    if (payload[field] === undefined || payload[field] === null) continue;
    if (typeof payload[field] !== "string") {
      throw new ApiError(400, `${field} must be a string`);
    }
    if (payload[field].length > max) {
      throw new ApiError(400, `${field} is too long (max ${max})`);
    }
  }

  if (
    payload.isDefault !== undefined &&
    typeof payload.isDefault !== "boolean"
  ) {
    throw new ApiError(400, "isDefault must be a boolean");
  }
};

module.exports = {
  validateProfileUpdate,
  validatePasswordChange,
  validateAddressPayload,
};
