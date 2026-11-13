const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { isExpoPushToken, registerPushToken, removePushToken } = require("../lib/pushService");

// POST /me/push-tokens  { token, platform }
const addPushToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body || {};
  if (!isExpoPushToken(token)) throw new ApiError(400, "A valid Expo push token is required");
  await registerPushToken(req.user.id, token, typeof platform === "string" ? platform.slice(0, 20) : "");
  res.status(200).json({ message: "Push token registered" });
});

// DELETE /me/push-tokens  { token } — called on logout
const deletePushToken = asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== "string" || !token) throw new ApiError(400, "token is required");
  await removePushToken(req.user.id, token);
  res.status(200).json({ message: "Push token removed" });
});

module.exports = { addPushToken, deletePushToken };
