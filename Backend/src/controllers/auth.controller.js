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
const Otp = require("../models/Otp");
const {
  validateLoginInput,
  validateRegisterInput,
} = require("../validators/auth.validator");
const env = require("../config/env");
const { onAccountWelcome } = require("../lib/notificationHooks");
const { sendEmail } = require("../lib/emailClient");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(); // Takes client IDs in verifyIdToken if needed

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

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = asyncHandler(async (req, res) => {
  validateRegisterInput(req.body);

  const { name, email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.status === "active") {
      throw new ApiError(409, "Email already registered");
    } else if (existingUser.status === "unverified") {
      // Allow them to restart the flow
      existingUser.name = name.trim();
      existingUser.password = password;
      await existingUser.save();
    }
  }

  let user = existingUser;
  if (!user) {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: "customer",
      status: "unverified",
    });
  }

  // Delete any old signup OTPs for this email
  await Otp.deleteMany({ email: normalizedEmail, purpose: "signup" });

  const otp = generateOtp();
  await Otp.create({ email: normalizedEmail, otp, purpose: "signup" });

  await sendEmail({
    to: normalizedEmail,
    subject: "Verify your email",
    body: `Your verification code is: ${otp}. It will expire in 10 minutes.`,
  });

  res.status(201).json({
    message: "Registration started. Please verify OTP sent to your email.",
    requiresOtp: true,
  });
});

const verifySignup = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }
  const normalizedEmail = email.trim().toLowerCase();

  const otpRecord = await Otp.findOne({ email: normalizedEmail, otp, purpose: "signup" });
  if (!otpRecord) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.status = "active";
  await user.save();
  await Otp.deleteOne({ _id: otpRecord._id });

  const tokens = await issueAuthTokens(user);
  onAccountWelcome(user);

  res.status(200).json({
    message: "Email verified successfully",
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

const resendSignupOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.status !== "unverified") {
    throw new ApiError(400, "User not found or already verified");
  }

  await Otp.deleteMany({ email: normalizedEmail, purpose: "signup" });
  const otp = generateOtp();
  await Otp.create({ email: normalizedEmail, otp, purpose: "signup" });

  await sendEmail({
    to: normalizedEmail,
    subject: "Verify your email",
    body: `Your new verification code is: ${otp}. It will expire in 10 minutes.`,
  });

  res.status(200).json({ message: "A new OTP has been sent." });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new ApiError(404, "No account found with this email address");
  }

  await Otp.deleteMany({ email: normalizedEmail, purpose: "reset_password" });
  const otp = generateOtp();
  await Otp.create({ email: normalizedEmail, otp, purpose: "reset_password" });

  await sendEmail({
    to: normalizedEmail,
    subject: "Reset your password",
    body: `Your password reset code is: ${otp}. It will expire in 10 minutes.`,
  });

  res.status(200).json({ message: "If an account exists, an OTP has been sent." });
});

const verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otpRecord = await Otp.findOne({ email: normalizedEmail, otp, purpose: "reset_password" });
  
  if (!otpRecord) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  res.status(200).json({ message: "OTP is valid" });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "Email, OTP, and new password are required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otpRecord = await Otp.findOne({ email: normalizedEmail, otp, purpose: "reset_password" });
  
  if (!otpRecord) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = newPassword;
  await user.save();
  await Otp.deleteOne({ _id: otpRecord._id });

  res.status(200).json({ message: "Password reset successful. You can now log in." });
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
    throw new ApiError(403, "Account is not active or unverified. Please verify your email.");
  }

  if (!user.password) {
     throw new ApiError(401, "Account was created with a social provider. Please use social login.");
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

const googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw new ApiError(400, "Google ID token is required");

  let payload;
  try {
    // Accept tokens issued to any client ID in our Google Cloud project
    // The Android app's idToken may have the Android client ID as audience,
    // not the web client ID, depending on GoogleSignin configuration
    const ticket = await googleClient.verifyIdToken({
      idToken,
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.error("Google token verification failed:", err.message);
    throw new ApiError(401, "Invalid Google token: " + err.message);
  }

  const { email, name, sub: googleId } = payload;
  const normalizedEmail = email.trim().toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // If user exists but no googleId, link it
    if (!user.googleId) {
      user.googleId = googleId;
      if (user.status === "unverified") user.status = "active";
      await user.save();
    }
    if (user.status !== "active") {
      throw new ApiError(403, "Account is not active");
    }
  } else {
    // Register new user
    user = await User.create({
      name: name || "Google User",
      email: normalizedEmail,
      password: Math.random().toString(36).slice(-10) + "A1!", // Random unused password
      role: "customer",
      status: "active",
      googleId,
    });
    onAccountWelcome(user);
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
  verifySignup,
  resendSignupOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  login,
  googleLogin,
  refresh,
  logout,
};
