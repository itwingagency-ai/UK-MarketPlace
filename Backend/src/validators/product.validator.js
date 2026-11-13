const ApiError = require("../lib/ApiError");

const MAX_PRODUCT_IMAGES = 10;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validateOptionsArray = (options) => {
  if (!Array.isArray(options)) {
    throw new ApiError(400, "options must be an array");
  }

  const seenNames = new Set();
  for (let i = 0; i < options.length; i += 1) {
    const opt = options[i];
    if (!isPlainObject(opt)) {
      throw new ApiError(400, `options[${i}] must be an object`);
    }
    if (
      !opt.name ||
      typeof opt.name !== "string" ||
      opt.name.trim().length < 1
    ) {
      throw new ApiError(400, `options[${i}].name is required`);
    }
    if (opt.name.trim().length > 40) {
      throw new ApiError(400, `options[${i}].name is too long (max 40)`);
    }
    // The name becomes a key in each variant's attributes map
    if (/[.$]/.test(opt.name)) {
      throw new ApiError(400, `options[${i}].name cannot contain "." or "$"`);
    }

    const nameKey = opt.name.trim().toLowerCase();
    if (seenNames.has(nameKey)) {
      throw new ApiError(400, `Duplicate option name "${opt.name}"`);
    }
    seenNames.add(nameKey);

    if (!Array.isArray(opt.values) || opt.values.length === 0) {
      throw new ApiError(
        400,
        `options[${i}] ("${opt.name}") must have at least one value`
      );
    }

    const seenValues = new Set();
    for (let j = 0; j < opt.values.length; j += 1) {
      const v = opt.values[j];
      if (typeof v !== "string" || v.trim().length === 0) {
        throw new ApiError(
          400,
          `options[${i}].values[${j}] must be a non-empty string`
        );
      }
      const valueKey = v.trim().toLowerCase();
      if (seenValues.has(valueKey)) {
        throw new ApiError(
          400,
          `Duplicate value "${v}" in option "${opt.name}"`
        );
      }
      seenValues.add(valueKey);
    }
  }
};

const buildOptionMap = (options) => {
  const map = {};
  for (const opt of options) {
    const key = opt.name.trim().toLowerCase();
    map[key] = new Set(opt.values.map((v) => v.trim().toLowerCase()));
  }
  return map;
};

const normalizeAttributes = (attrs) => {
  if (!attrs) return {};
  if (attrs instanceof Map) return Object.fromEntries(attrs);
  if (isPlainObject(attrs)) return attrs;
  return {};
};

const validateVariantsArray = (variants, options = []) => {
  if (!Array.isArray(variants)) {
    throw new ApiError(400, "variants must be an array");
  }
  if (variants.length === 0) return;

  const optionMap = buildOptionMap(options);
  const declaredOptionNames = Object.keys(optionMap);
  const skuSeen = new Set();
  const attrSignatures = new Set();

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    if (!isPlainObject(variant)) {
      throw new ApiError(400, `variants[${i}] must be an object`);
    }

    if (
      variant.price === undefined ||
      variant.price === null ||
      variant.price === ""
    ) {
      throw new ApiError(400, `variants[${i}].price is required`);
    }
    const priceNum = Number(variant.price);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      throw new ApiError(
        400,
        `variants[${i}].price must be a non-negative whole number of pence`
      );
    }

    if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
      const cmp = Number(variant.compareAtPrice);
      if (!Number.isInteger(cmp) || cmp < 0) {
        throw new ApiError(
          400,
          `variants[${i}].compareAtPrice must be a non-negative whole number of pence`
        );
      }
    }

    if (variant.stock !== undefined && variant.stock !== null) {
      const stockNum = Number(variant.stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        throw new ApiError(
          400,
          `variants[${i}].stock must be a non-negative integer`
        );
      }
    }

    if (variant.sku) {
      if (typeof variant.sku !== "string") {
        throw new ApiError(400, `variants[${i}].sku must be a string`);
      }
      if (variant.sku.trim().length > 80) {
        throw new ApiError(400, `variants[${i}].sku is too long (max 80)`);
      }
      const skuKey = variant.sku.trim().toLowerCase();
      if (skuKey) {
        if (skuSeen.has(skuKey)) {
          throw new ApiError(
            400,
            `Duplicate SKU "${variant.sku}" within product variants`
          );
        }
        skuSeen.add(skuKey);
      }
    }

    if (variant.images !== undefined && !Array.isArray(variant.images)) {
      throw new ApiError(400, `variants[${i}].images must be an array`);
    }

    const attributes = normalizeAttributes(variant.attributes);
    if (
      variant.attributes !== undefined &&
      !isPlainObject(variant.attributes) &&
      !(variant.attributes instanceof Map)
    ) {
      throw new ApiError(
        400,
        `variants[${i}].attributes must be an object map`
      );
    }

    const attrKeys = Object.keys(attributes).map((k) => k.trim().toLowerCase());

    if (declaredOptionNames.length > 0) {
      for (const optName of declaredOptionNames) {
        if (!attrKeys.includes(optName)) {
          throw new ApiError(
            400,
            `variants[${i}] is missing value for option "${optName}"`
          );
        }
        const rawValue =
          attributes[optName] ??
          attributes[Object.keys(attributes).find(
            (k) => k.trim().toLowerCase() === optName
          )];
        const normalizedValue = String(rawValue || "")
          .trim()
          .toLowerCase();
        if (!normalizedValue) {
          throw new ApiError(
            400,
            `variants[${i}] option "${optName}" cannot be empty`
          );
        }
        if (!optionMap[optName].has(normalizedValue)) {
          throw new ApiError(
            400,
            `variants[${i}] has invalid value "${rawValue}" for option "${optName}"`
          );
        }
      }

      for (const k of attrKeys) {
        if (!declaredOptionNames.includes(k)) {
          throw new ApiError(
            400,
            `variants[${i}] has undeclared option "${k}"`
          );
        }
      }
    }

    const sig = Object.entries(attributes)
      .map(([k, val]) =>
        `${String(k).trim().toLowerCase()}=${String(val).trim().toLowerCase()}`
      )
      .sort()
      .join("|");
    if (sig) {
      if (attrSignatures.has(sig)) {
        throw new ApiError(
          400,
          `Duplicate variant attribute combination at variants[${i}]`
        );
      }
      attrSignatures.add(sig);
    }
  }
};

const validateProductPayload = (payload, isPatch = false) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Invalid product payload");
  }

  // Variant products take price and stock from their variants.
  const hasVariants =
    Array.isArray(payload.variants) && payload.variants.length > 0;
  const requiredKeys = hasVariants ? ["title"] : ["title", "price", "stock"];
  if (!isPatch) {
    for (const key of requiredKeys) {
      if (
        payload[key] === undefined ||
        payload[key] === null ||
        payload[key] === ""
      ) {
        throw new ApiError(400, `${key} is required`);
      }
    }
  }

  if (payload.title !== undefined) {
    if (typeof payload.title !== "string" || payload.title.trim().length < 2) {
      throw new ApiError(400, "title must be at least 2 characters");
    }
    if (payload.title.trim().length > 140) {
      throw new ApiError(400, "title must be 140 characters or less");
    }
  }

  if (payload.description !== undefined && payload.description !== null) {
    if (typeof payload.description !== "string") {
      throw new ApiError(400, "description must be a string");
    }
    if (payload.description.length > 2500) {
      throw new ApiError(400, "description must be 2500 characters or less");
    }
  }

  if (payload.size !== undefined && payload.size !== null) {
    if (typeof payload.size !== "string") {
      throw new ApiError(400, "size must be a string");
    }
    if (payload.size.trim().length > 60) {
      throw new ApiError(400, "size must be 60 characters or less");
    }
  }

  if (payload.price !== undefined && !(hasVariants && payload.price === "")) {
    const n = Number(payload.price);
    if (!Number.isInteger(n) || n < 0) {
      throw new ApiError(400, "price must be a non-negative whole number of pence");
    }
  }

  if (payload.compareAtPrice !== undefined && payload.compareAtPrice !== null) {
    const n = Number(payload.compareAtPrice);
    if (!Number.isInteger(n) || n < 0) {
      throw new ApiError(400, "compareAtPrice must be a non-negative whole number of pence");
    }
  }

  if (payload.stock !== undefined && !(hasVariants && payload.stock === "")) {
    const n = Number(payload.stock);
    if (!Number.isInteger(n) || n < 0) {
      throw new ApiError(400, "stock must be a non-negative integer");
    }
  }

  if (payload.images !== undefined) {
    if (!Array.isArray(payload.images)) {
      throw new ApiError(400, "images must be an array of URL strings");
    }
    if (payload.images.length > MAX_PRODUCT_IMAGES) {
      throw new ApiError(400, `A product can have at most ${MAX_PRODUCT_IMAGES} images`);
    }
    for (let i = 0; i < payload.images.length; i += 1) {
      if (typeof payload.images[i] !== "string") {
        throw new ApiError(400, `images[${i}] must be a string`);
      }
    }
  }

  if (payload.options !== undefined) {
    validateOptionsArray(payload.options);
  }

  if (payload.variants !== undefined) {
    validateVariantsArray(payload.variants, payload.options || []);
  }
};

module.exports = {
  MAX_PRODUCT_IMAGES,
  validateProductPayload,
  validateOptionsArray,
  validateVariantsArray,
};
