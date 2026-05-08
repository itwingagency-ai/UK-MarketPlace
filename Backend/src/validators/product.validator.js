const ApiError = require("../lib/ApiError");

const validateProductPayload = (payload, isPatch = false) => {
  const requiredKeys = ["title", "price", "stock"];
  if (!isPatch) {
    for (const key of requiredKeys) {
      if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
        throw new ApiError(400, `${key} is required`);
      }
    }
  }

  if (payload.title !== undefined && payload.title.trim().length < 2) {
    throw new ApiError(400, "title must be at least 2 characters");
  }

  if (payload.price !== undefined && Number(payload.price) < 0) {
    throw new ApiError(400, "price cannot be negative");
  }

  if (payload.compareAtPrice !== undefined && payload.compareAtPrice !== null) {
    if (Number(payload.compareAtPrice) < 0) {
      throw new ApiError(400, "compareAtPrice cannot be negative");
    }
  }

  if (payload.stock !== undefined && (!Number.isInteger(Number(payload.stock)) || Number(payload.stock) < 0)) {
    throw new ApiError(400, "stock must be a non-negative integer");
  }
};

module.exports = { validateProductPayload };
