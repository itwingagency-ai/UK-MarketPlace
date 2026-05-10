const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const { validateAddressPayload } = require("./profile.validator");

const VALID_PAYMENT_METHODS = ["cod", "online"];

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validateCheckoutPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid checkout payload");
  }

  const hasAddressId = Boolean(payload.addressId);
  const hasInlineAddress = Boolean(payload.shippingAddress);

  if (!hasAddressId && !hasInlineAddress) {
    throw new ApiError(
      400,
      "Either addressId or shippingAddress must be provided"
    );
  }
  if (hasAddressId && hasInlineAddress) {
    throw new ApiError(
      400,
      "Provide either addressId or shippingAddress, not both"
    );
  }

  if (hasAddressId && !mongoose.Types.ObjectId.isValid(payload.addressId)) {
    throw new ApiError(400, "addressId must be a valid id");
  }

  if (hasInlineAddress) {
    validateAddressPayload(payload.shippingAddress);
  }

  if (
    !payload.paymentMethod ||
    !VALID_PAYMENT_METHODS.includes(payload.paymentMethod)
  ) {
    throw new ApiError(
      400,
      `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`
    );
  }

  if (payload.notes !== undefined && payload.notes !== null) {
    if (typeof payload.notes !== "string") {
      throw new ApiError(400, "notes must be a string");
    }
    if (payload.notes.length > 500) {
      throw new ApiError(400, "notes must be 500 characters or less");
    }
  }

  if (payload.shippingSelections !== undefined && payload.shippingSelections !== null) {
    if (!Array.isArray(payload.shippingSelections)) {
      throw new ApiError(400, "shippingSelections must be an array");
    }
    const seenStores = new Set();
    for (const selection of payload.shippingSelections) {
      if (!isPlainObject(selection)) {
        throw new ApiError(400, "Each shippingSelection must be an object");
      }
      if (
        !selection.storeId ||
        !mongoose.Types.ObjectId.isValid(selection.storeId)
      ) {
        throw new ApiError(
          400,
          "shippingSelections[].storeId must be a valid id"
        );
      }
      if (seenStores.has(String(selection.storeId))) {
        throw new ApiError(
          400,
          "shippingSelections cannot contain duplicate storeId entries"
        );
      }
      seenStores.add(String(selection.storeId));

      if (
        selection.shippingMethodId !== undefined &&
        selection.shippingMethodId !== null &&
        selection.shippingMethodId !== "" &&
        !mongoose.Types.ObjectId.isValid(selection.shippingMethodId)
      ) {
        throw new ApiError(
          400,
          "shippingSelections[].shippingMethodId must be a valid id"
        );
      }
    }
  }
};

module.exports = {
  VALID_PAYMENT_METHODS,
  validateCheckoutPayload,
};
