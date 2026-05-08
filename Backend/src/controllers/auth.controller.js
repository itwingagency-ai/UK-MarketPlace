const ms = require("ms");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../lib/jwt");
const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
const {
  validateLoginInput,
  validateRegisterInput,
} = require("../validators/auth.validator");
const env = require("../config/env");

const getTokenExpiryDate = (expiresIn) =>
  new Date(Date.now() + Number(ms(expiresIn)));

const persistRefreshToken = async (userId, rawToken, tokenId) => {
  const tokenHash = hashToken(rawToken);
  const expiresAt = getTokenExpiryDate(env.jwtRefreshExpiresIn);

  await RefreshToken.create({
    user: userId,
    tokenHash,
    tokenId,
    expiresAt,
  });
};

const issueAuthTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);

  await persistRefreshToken(user._id, refresh.token, refresh.tokenId);

  return {
    accessToken,
    refreshToken: refresh.token,
  };
};

const register = asyncHandler(async (req, res) => {
  validateRegisterInput(req.body);

  const { name, email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "Email already registered");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: "customer",
  });

  const tokens = await issueAuthTokens(user);

  res.status(201).json({
    message: "Registration successful",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    ...tokens,
  });
});

const login = asyncHandler(async (req, res) => {
  validateLoginInput(req.body);

  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "Account is not active");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const tokens = await issueAuthTokens(user);

  res.status(200).json({
    message: "Login successful",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    ...tokens,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.body.refreshToken;
  if (!incomingToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  let payload;
  try {
    payload = verifyRefreshToken(incomingToken);
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const tokenHash = hashToken(incomingToken);

  const existingRefreshToken = await RefreshToken.findOne({
    tokenHash,
    tokenId: payload.tokenId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!existingRefreshToken) {
    throw new ApiError(401, "Refresh token not recognized");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active") {
    throw new ApiError(401, "User session is invalid");
  }

  const newRefresh = signRefreshToken(user);
  const newAccessToken = signAccessToken(user);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(newRefresh.token),
    tokenId: newRefresh.tokenId,
    expiresAt: getTokenExpiryDate(env.jwtRefreshExpiresIn),
  });

  existingRefreshToken.revokedAt = new Date();
  existingRefreshToken.replacedByTokenId = newRefresh.tokenId;
  await existingRefreshToken.save();

  res.status(200).json({
    message: "Token refreshed",
    accessToken: newAccessToken,
    refreshToken: newRefresh.token,
  });
});

const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.body.refreshToken;
  if (!incomingToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  const tokenHash = hashToken(incomingToken);
  await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { revokedAt: new Date() }
  );

  res.status(200).json({
    message: "Logout successful",
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
};
