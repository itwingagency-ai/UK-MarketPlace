const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const ShippingMethod = require("../models/ShippingMethod");
const {
  slugify,
  validateShippingMethodPayload,
} = require("../validators/shipping.validator");

const ensureUniqueCode = async (storeId, baseCode, ignoreId = null) => {
  let code = baseCode;
  let attempt = 1;
  while (attempt <= 100) {
    const filter = { store: storeId, code };
    if (ignoreId) filter._id = { $ne: ignoreId };
    // eslint-disable-next-line no-await-in-loop
    const exists = await ShippingMethod.findOne(filter).select("_id").lean();
    if (!exists) return code;
    attempt += 1;
    code = `${baseCode}-${attempt}`;
  }
  throw new ApiError(409, "Could not derive a unique shipping method code");
};

const listShippingMethods = asyncHandler(async (req, res) => {
  const filter = { ...req.storeScopeFilter };
  if (req.query.active === "true") filter.isActive = true;
  if (req.query.active === "false") filter.isActive = false;

  const methods = await ShippingMethod.find(filter).sort({
    sortOrder: 1,
    fee: 1,
    createdAt: 1,
  });

  res.status(200).json({ data: methods });
});

const getShippingMethod = asyncHandler(async (req, res) => {
  const method = req.scopedResource;
  if (!method) throw new ApiError(404, "Shipping method not found");
  res.status(200).json({ data: method });
});

const createShippingMethod = asyncHandler(async (req, res) => {
  validateShippingMethodPayload(req.body);

  const storeId = resolveTargetStoreId(req);
  if (!storeId) throw new ApiError(400, "storeId is required");

  const baseCode = slugify(req.body.code || req.body.name);
  if (!baseCode) {
    throw new ApiError(400, "Could not derive a code from name");
  }
  const code = await ensureUniqueCode(storeId, baseCode);

  const method = await ShippingMethod.create({
    store: storeId,
    name: req.body.name.trim(),
    code,
    description:
      typeof req.body.description === "string" ? req.body.description : "",
    fee: Number(req.body.fee),
    minDays: req.body.minDays !== undefined ? Number(req.body.minDays) : 0,
    maxDays: req.body.maxDays !== undefined ? Number(req.body.maxDays) : 0,
    isActive:
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    sortOrder:
      req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : 0,
  });

  res.status(201).json({
    message: "Shipping method created",
    data: method,
  });
});

const updateShippingMethod = asyncHandler(async (req, res) => {
  validateShippingMethodPayload(req.body, { isPatch: true });

  const method = req.scopedResource;
  if (!method) throw new ApiError(404, "Shipping method not found");

  if (req.body.name !== undefined) method.name = req.body.name.trim();
  if (req.body.description !== undefined) {
    method.description = String(req.body.description);
  }
  if (req.body.fee !== undefined) method.fee = Number(req.body.fee);
  if (req.body.minDays !== undefined) method.minDays = Number(req.body.minDays);
  if (req.body.maxDays !== undefined) method.maxDays = Number(req.body.maxDays);
  if (req.body.isActive !== undefined) {
    method.isActive = Boolean(req.body.isActive);
  }
  if (req.body.sortOrder !== undefined) {
    method.sortOrder = Number(req.body.sortOrder);
  }

  if (
    req.body.code !== undefined &&
    req.body.code !== null &&
    req.body.code !== ""
  ) {
    const desired = slugify(req.body.code);
    if (desired && desired !== method.code) {
      method.code = await ensureUniqueCode(method.store, desired, method._id);
    }
  }

  await method.save();
  res.status(200).json({
    message: "Shipping method updated",
    data: method,
  });
});

const deleteShippingMethod = asyncHandler(async (req, res) => {
  const method = req.scopedResource;
  if (!method) throw new ApiError(404, "Shipping method not found");

  // Hard delete is safe because shipping method details are snapshotted onto orders at checkout
  await method.deleteOne();
  res.status(200).json({ message: "Shipping method deleted" });
});

module.exports = {
  listShippingMethods,
  getShippingMethod,
  createShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
};
