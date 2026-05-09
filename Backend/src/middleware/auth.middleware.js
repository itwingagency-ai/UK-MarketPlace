const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { verifyAccessToken } = require("../lib/jwt");
const User = require("../models/User");

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication token missing");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const user = await User.findById(payload.sub).select("-password");
  if (!user) {
    throw new ApiError(401, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "Account is not active");
  }

  req.user = {
    id: user._id.toString(),
    role: user.role,
    storeId: user.storeId || null,
  };

  next();
});

module.exports = { authenticate };
