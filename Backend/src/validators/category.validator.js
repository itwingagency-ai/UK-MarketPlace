const ApiError = require("../lib/ApiError");

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugify = (input) =>
  String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const validateCategoryPayload = (payload, isPatch = false) => {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Invalid category payload");
  }

  if (!isPatch || payload.name !== undefined) {
    if (
      !payload.name ||
      typeof payload.name !== "string" ||
      payload.name.trim().length < 2
    ) {
      throw new ApiError(400, "name must be at least 2 characters");
    }
    if (payload.name.trim().length > 80) {
      throw new ApiError(400, "name must be 80 characters or less");
    }
  }

  if (
    payload.slug !== undefined &&
    payload.slug !== null &&
    payload.slug !== ""
  ) {
    if (
      typeof payload.slug !== "string" ||
      !SLUG_REGEX.test(payload.slug.trim().toLowerCase())
    ) {
      throw new ApiError(
        400,
        "slug must be lowercase letters, numbers, and single hyphens"
      );
    }
  }

  if (
    payload.description !== undefined &&
    payload.description !== null &&
    typeof payload.description !== "string"
  ) {
    throw new ApiError(400, "description must be a string");
  }
  if (payload.description && payload.description.length > 500) {
    throw new ApiError(400, "description must be 500 characters or less");
  }

  if (payload.image !== undefined && payload.image !== null) {
    if (typeof payload.image !== "string") {
      throw new ApiError(400, "image must be a string URL");
    }
    if (payload.image.length > 500) {
      throw new ApiError(400, "image URL is too long");
    }
  }
};

module.exports = {
  validateCategoryPayload,
  slugify,
};
