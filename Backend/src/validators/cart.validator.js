const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validateAddItemPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid cart item payload");
  }

  if (
    !payload.productId ||
    !mongoose.Types.ObjectId.isValid(payload.productId)
  ) {
    throw new ApiError(400, "valid productId is required");
  }

  if (
    payload.variantId !== undefined &&
    payload.variantId !== null &&
    payload.variantId !== ""
  ) {
    if (!mongoose.Types.ObjectId.isValid(payload.variantId)) {
      throw new ApiError(400, "variantId must be a valid id");
    }
  }

  if (payload.quantity !== undefined && payload.quantity !== null) {
    const q = Number(payload.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 999) {
      throw new ApiError(400, "quantity must be an integer between 1 and 999");
    }
  }
};

const validateUpdateQuantityPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid update payload");
  }
  if (payload.quantity === undefined || payload.quantity === null) {
    throw new ApiError(400, "quantity is required");
  }
  const q = Number(payload.quantity);
  if (!Number.isInteger(q) || q < 0 || q > 999) {
    throw new ApiError(
      400,
      "quantity must be an integer between 0 and 999 (0 to remove)"
    );
  }
};

module.exports = {
  validateAddItemPayload,
  validateUpdateQuantityPayload,
};
