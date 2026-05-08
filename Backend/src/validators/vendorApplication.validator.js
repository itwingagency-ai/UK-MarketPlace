const ApiError = require("../lib/ApiError");

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeSlug = (slug) =>
  typeof slug === "string" ? slug.trim().toLowerCase() : "";

const validateVendorApplicationSubmit = (payload) => {
  const { storeName, slug } = payload;

  if (!storeName || typeof storeName !== "string" || storeName.trim().length < 2) {
    throw new ApiError(400, "storeName must be at least 2 characters");
  }

  const normalized = normalizeSlug(slug);
  if (!normalized || normalized.length < 2) {
    throw new ApiError(400, "slug is required");
  }

  if (!SLUG_REGEX.test(normalized)) {
    throw new ApiError(
      400,
      "slug must be lowercase letters, numbers, and single hyphens only"
    );
  }

  if (payload.contact?.email && payload.contact.email.length > 120) {
    throw new ApiError(400, "contact.email is too long");
  }

  return { storeName: storeName.trim(), slug: normalized };
};

const validateAdminApprovePayload = (payload) => {
  if (!payload || typeof payload !== "object") return {};

  const out = {};
  if (payload.storeName !== undefined) {
    if (
      typeof payload.storeName !== "string" ||
      payload.storeName.trim().length < 2
    ) {
      throw new ApiError(400, "storeName override must be at least 2 characters");
    }
    out.storeName = payload.storeName.trim();
  }

  if (payload.slug !== undefined) {
    const s = normalizeSlug(payload.slug);
    if (!SLUG_REGEX.test(s)) {
      throw new ApiError(
        400,
        "slug override must be lowercase alphanumeric with hyphens"
      );
    }
    out.slug = s;
  }

  return out;
};

module.exports = {
  validateVendorApplicationSubmit,
  normalizeSlug,
  validateAdminApprovePayload,
};
