const ApiError = require("../lib/ApiError");

const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthenticated request"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You are not authorized for this resource"));
    }

    return next();
  };

module.exports = { authorize };
