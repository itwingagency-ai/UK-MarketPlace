const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");

const resolveStoreScope = (req, res, next) => {
  const { role, storeId } = req.user;

  if (role === "vendor") {
    if (!storeId) {
      return next(new ApiError(403, "Vendor is not assigned to a store"));
    }
    req.storeScopeId = storeId;
    req.storeScopeFilter = { store: storeId };
    return next();
  }

  if (role === "admin") {
    const adminStoreId = req.query.storeId;
    if (adminStoreId && !mongoose.Types.ObjectId.isValid(adminStoreId)) {
      return next(new ApiError(400, "Invalid storeId query parameter"));
    }
    req.storeScopeId = adminStoreId || null;
    req.storeScopeFilter = adminStoreId ? { store: adminStoreId } : {};
    return next();
  }

  return next(new ApiError(403, "Only vendor or admin can access this module"));
};

const requireResourceInScope = (model, idParam = "id", storeField = "store") =>
  async (req, res, next) => {
    const resourceId = req.params[idParam];
    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return next(new ApiError(400, "Invalid resource id"));
    }

    const query = { _id: resourceId };
    if (req.user.role === "vendor") {
      query[storeField] = req.storeScopeId;
    } else if (req.user.role === "admin" && req.storeScopeId) {
      query[storeField] = req.storeScopeId;
    }

    const resource = await model.findOne(query);
    if (!resource) {
      return next(new ApiError(404, "Resource not found in current store scope"));
    }

    req.scopedResource = resource;
    return next();
  };

const resolveTargetStoreId = (req, fieldName = "storeId") => {
  if (req.user.role === "vendor") {
    return req.storeScopeId;
  }

  const candidate = req.body[fieldName] || req.query[fieldName];
  if (!candidate) {
    throw new ApiError(400, "storeId is required for this admin action");
  }
  if (!mongoose.Types.ObjectId.isValid(candidate)) {
    throw new ApiError(400, "Invalid storeId");
  }

  return candidate;
};

module.exports = {
  resolveStoreScope,
  requireResourceInScope,
  resolveTargetStoreId,
};
