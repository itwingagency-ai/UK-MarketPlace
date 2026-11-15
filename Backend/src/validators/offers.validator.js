const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const COUPON_CODE = /^[A-Za-z0-9_-]{3,30}$/;
const MAX_TIP = 5000; // £50
const MAX_PENCE = 100000000; // £1,000,000 — sanity cap for any configured amount

const isPence = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_PENCE;

const checkPence = (payload, field, { nullable = false } = {}) => {
  if (payload[field] === undefined) return;
  if (nullable && payload[field] === null) return;
  if (!isPence(payload[field])) {
    throw new ApiError(400, `${field} must be a whole number of pence`);
  }
};

const checkDate = (payload, field) => {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") return;
  if (Number.isNaN(new Date(payload[field]).getTime())) {
    throw new ApiError(400, `${field} must be a valid date`);
  }
};

const checkIdList = (payload, field) => {
  if (payload[field] === undefined) return;
  if (!Array.isArray(payload[field]) || payload[field].length > 200) {
    throw new ApiError(400, `${field} must be a list of up to 200 ids`);
  }
  if (!payload[field].every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(400, `${field} contains an invalid id`);
  }
};

/* ── Cart intent ─────────────────────────────────────────────────────── */

const validateCouponCode = (payload) => {
  if (!isPlainObject(payload) || typeof payload.code !== "string" || !COUPON_CODE.test(payload.code.trim())) {
    throw new ApiError(400, "Enter a valid code (3-30 letters, numbers, - or _)");
  }
};

const validateTipPayload = (payload) => {
  if (!isPlainObject(payload)) throw new ApiError(400, "Invalid tip payload");
  if (!payload.storeId || !mongoose.Types.ObjectId.isValid(payload.storeId)) {
    throw new ApiError(400, "valid storeId is required");
  }
  if (!Number.isInteger(payload.amount) || payload.amount < 0 || payload.amount > MAX_TIP) {
    throw new ApiError(400, `Tip must be whole pence between 0 and ${MAX_TIP}`);
  }
};

const validateCartOptionsPayload = (payload) => {
  if (!isPlainObject(payload)) throw new ApiError(400, "Invalid options payload");
  if (payload.allowSubstitutions !== undefined && typeof payload.allowSubstitutions !== "boolean") {
    throw new ApiError(400, "allowSubstitutions must be true or false");
  }
  if (payload.stores !== undefined) {
    if (!Array.isArray(payload.stores) || payload.stores.length > 50) {
      throw new ApiError(400, "stores must be a list");
    }
    for (const entry of payload.stores) {
      if (!isPlainObject(entry) || !mongoose.Types.ObjectId.isValid(entry.storeId)) {
        throw new ApiError(400, "Each store entry needs a valid storeId");
      }
      if (entry.note !== undefined && (typeof entry.note !== "string" || entry.note.length > 500)) {
        throw new ApiError(400, "note must be text of 500 characters or less");
      }
      if (entry.bags !== undefined && typeof entry.bags !== "boolean") {
        throw new ApiError(400, "bags must be true or false");
      }
    }
  }
};

/* ── Coupons ─────────────────────────────────────────────────────────── */

const validateCouponPayload = (payload, { isUpdate = false, isAdmin = false } = {}) => {
  if (!isPlainObject(payload)) throw new ApiError(400, "Invalid coupon payload");

  if (!isUpdate || payload.code !== undefined) {
    if (typeof payload.code !== "string" || !COUPON_CODE.test(payload.code.trim())) {
      throw new ApiError(400, "code must be 3-30 letters, numbers, - or _");
    }
  }
  if (!isUpdate || payload.type !== undefined) {
    if (!["percent", "fixed", "free_delivery"].includes(payload.type)) {
      throw new ApiError(400, "type must be percent, fixed or free_delivery");
    }
  }
  const checkValue = !isUpdate || payload.value !== undefined;
  if (checkValue && payload.type === "percent" && (!Number.isInteger(payload.value) || payload.value < 1 || payload.value > 100)) {
    throw new ApiError(400, "A percentage must be a whole number from 1 to 100");
  }
  if (checkValue && payload.type === "fixed" && (!isPence(payload.value) || payload.value < 1)) {
    throw new ApiError(400, "A fixed discount must be at least 1p");
  }
  checkPence(payload, "maxDiscount", { nullable: true });
  checkPence(payload, "minSubtotal");
  checkDate(payload, "startsAt");
  checkDate(payload, "endsAt");
  if (payload.usageLimit !== undefined && payload.usageLimit !== null) {
    if (!Number.isInteger(payload.usageLimit) || payload.usageLimit < 1) {
      throw new ApiError(400, "usageLimit must be a whole number of at least 1, or empty");
    }
  }
  if (payload.perUserLimit !== undefined) {
    if (!Number.isInteger(payload.perUserLimit) || payload.perUserLimit < 1 || payload.perUserLimit > 1000) {
      throw new ApiError(400, "perUserLimit must be between 1 and 1000");
    }
  }
  for (const flag of ["firstOrderOnly", "isActive"]) {
    if (payload[flag] !== undefined && typeof payload[flag] !== "boolean") {
      throw new ApiError(400, `${flag} must be true or false`);
    }
  }
  if (payload.description !== undefined && (typeof payload.description !== "string" || payload.description.length > 200)) {
    throw new ApiError(400, "description must be 200 characters or less");
  }

  if (isAdmin) {
    if (!isUpdate || payload.scope !== undefined) {
      if (!["platform", "store"].includes(payload.scope)) {
        throw new ApiError(400, "scope must be platform or store");
      }
    }
    if (payload.scope === "store" && !mongoose.Types.ObjectId.isValid(payload.store)) {
      throw new ApiError(400, "A store coupon needs a valid store");
    }
    if (payload.fundedBy !== undefined && !["platform", "vendor"].includes(payload.fundedBy)) {
      throw new ApiError(400, "fundedBy must be platform or vendor");
    }
  }
};

/* ── Promotions ──────────────────────────────────────────────────────── */

const validatePromotionPayload = (payload, { isUpdate = false, isAdmin = false } = {}) => {
  if (!isPlainObject(payload)) throw new ApiError(400, "Invalid offer payload");
  if (!isUpdate || payload.name !== undefined) {
    if (typeof payload.name !== "string" || payload.name.trim().length < 2 || payload.name.length > 80) {
      throw new ApiError(400, "name must be 2-80 characters");
    }
  }
  if (!isUpdate || payload.type !== undefined) {
    if (!["spend_and_save", "multibuy"].includes(payload.type)) {
      throw new ApiError(400, "type must be spend_and_save or multibuy");
    }
  }
  if (payload.discountType !== undefined && !["percent", "fixed"].includes(payload.discountType)) {
    throw new ApiError(400, "discountType must be percent or fixed");
  }
  if (payload.discountValue !== undefined) {
    const max = payload.discountType === "percent" ? 100 : MAX_PENCE;
    if (!Number.isInteger(payload.discountValue) || payload.discountValue < 0 || payload.discountValue > max) {
      throw new ApiError(400, "discountValue is out of range");
    }
  }
  checkPence(payload, "minSubtotal");
  checkPence(payload, "maxDiscount", { nullable: true });
  for (const q of ["buyQuantity", "getQuantity"]) {
    if (payload[q] !== undefined && (!Number.isInteger(payload[q]) || payload[q] < 0 || payload[q] > 50)) {
      throw new ApiError(400, `${q} must be between 0 and 50`);
    }
  }
  checkIdList(payload, "products");
  checkIdList(payload, "categories");
  checkDate(payload, "startsAt");
  checkDate(payload, "endsAt");
  if (payload.isActive !== undefined && typeof payload.isActive !== "boolean") {
    throw new ApiError(400, "isActive must be true or false");
  }
  if (isAdmin) {
    if (!isUpdate || payload.scope !== undefined) {
      if (!["platform", "store"].includes(payload.scope)) {
        throw new ApiError(400, "scope must be platform or store");
      }
    }
    if (payload.scope === "store" && !mongoose.Types.ObjectId.isValid(payload.store)) {
      throw new ApiError(400, "A store offer needs a valid store");
    }
    if (payload.fundedBy !== undefined && !["platform", "vendor"].includes(payload.fundedBy)) {
      throw new ApiError(400, "fundedBy must be platform or vendor");
    }
  }
};

/* ── Platform fees (admin settings) ──────────────────────────────────── */

const validateFeesPayload = (fees) => {
  if (!isPlainObject(fees)) throw new ApiError(400, "fees must be an object");
  const sections = {
    service: ["percent", "min", "max"],
    smallOrder: ["threshold", "amount"],
    bag: ["amount"],
  };
  for (const [name, numbers] of Object.entries(sections)) {
    const sec = fees[name];
    if (sec === undefined) continue;
    if (!isPlainObject(sec)) throw new ApiError(400, `fees.${name} must be an object`);
    if (sec.enabled !== undefined && typeof sec.enabled !== "boolean") {
      throw new ApiError(400, `fees.${name}.enabled must be true or false`);
    }
    for (const n of numbers) {
      if (sec[n] === undefined) continue;
      if (n === "percent") {
        if (typeof sec[n] !== "number" || sec[n] < 0 || sec[n] > 20) {
          throw new ApiError(400, "fees.service.percent must be between 0 and 20");
        }
      } else if (!isPence(sec[n])) {
        throw new ApiError(400, `fees.${name}.${n} must be a whole number of pence`);
      }
    }
    for (const t of ["label", "info"]) {
      if (sec[t] !== undefined && (typeof sec[t] !== "string" || sec[t].length > (t === "label" ? 60 : 200))) {
        throw new ApiError(400, `fees.${name}.${t} is too long`);
      }
    }
  }
};

module.exports = {
  validateCouponCode,
  validateTipPayload,
  validateCartOptionsPayload,
  validateCouponPayload,
  validatePromotionPayload,
  validateFeesPayload,
  MAX_TIP,
};
