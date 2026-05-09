const ApiError = require("../lib/ApiError");

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validateShippingMethodPayload = (payload, { isPatch = false } = {}) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid payload");
  }

  if (!isPatch || payload.name !== undefined) {
    if (
      typeof payload.name !== "string" ||
      payload.name.trim().length < 2 ||
      payload.name.trim().length > 80
    ) {
      throw new ApiError(400, "name must be 2-80 characters");
    }
  }

  if (payload.code !== undefined && payload.code !== null && payload.code !== "") {
    if (
      typeof payload.code !== "string" ||
      !SLUG_REGEX.test(String(payload.code).toLowerCase().trim())
    ) {
      throw new ApiError(
        400,
        "code must be lowercase alphanumeric with hyphens (e.g. express)"
      );
    }
    if (payload.code.length > 40) {
      throw new ApiError(400, "code must be 40 characters or less");
    }
  }

  if (!isPatch || payload.fee !== undefined) {
    if (payload.fee === undefined || payload.fee === null) {
      throw new ApiError(400, "fee is required");
    }
    const n = Number(payload.fee);
    if (!Number.isFinite(n) || n < 0) {
      throw new ApiError(400, "fee must be a non-negative number");
    }
  }

  for (const key of ["minDays", "maxDays"]) {
    if (payload[key] !== undefined && payload[key] !== null) {
      const n = Number(payload[key]);
      if (!Number.isInteger(n) || n < 0 || n > 90) {
        throw new ApiError(400, `${key} must be an integer between 0 and 90`);
      }
    }
  }

  if (payload.minDays !== undefined && payload.maxDays !== undefined) {
    if (Number(payload.minDays) > Number(payload.maxDays)) {
      throw new ApiError(400, "minDays cannot exceed maxDays");
    }
  }

  if (payload.description !== undefined && payload.description !== null) {
    if (typeof payload.description !== "string" || payload.description.length > 500) {
      throw new ApiError(400, "description must be a string up to 500 chars");
    }
  }

  if (payload.isActive !== undefined && typeof payload.isActive !== "boolean") {
    throw new ApiError(400, "isActive must be boolean");
  }

  if (payload.sortOrder !== undefined && payload.sortOrder !== null) {
    const n = Number(payload.sortOrder);
    if (!Number.isFinite(n)) {
      throw new ApiError(400, "sortOrder must be a number");
    }
  }
};

module.exports = {
  slugify,
  validateShippingMethodPayload,
};
