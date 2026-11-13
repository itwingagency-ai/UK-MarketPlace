const User = require("../models/User");

/**
 * Expo push notifications. Devices register their Expo push token through
 * POST /api/v1/me/push-tokens; this sends to every device of the given users.
 *
 * Delivery to Android needs the app's Firebase (FCM) credentials configured
 * in the Expo project. Without them Expo accepts nothing for that device and
 * the in-app (Socket.IO) alerts are the only channel.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_TOKENS_PER_USER = 5;
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

const isExpoPushToken = (token) => typeof token === "string" && EXPO_TOKEN_RE.test(token);

const registerPushToken = async (userId, token, platform = "") => {
  // Keep a device's token on one account only, newest first, capped
  await User.updateMany({ _id: { $ne: userId } }, { $pull: { pushTokens: { token } } });
  const user = await User.findById(userId).select("+pushTokens");
  if (!user) return;
  const others = (user.pushTokens || []).filter((t) => t.token !== token);
  user.pushTokens = [{ token, platform, updatedAt: new Date() }, ...others].slice(0, MAX_TOKENS_PER_USER);
  await user.save();
};

const removePushToken = (userId, token) =>
  User.updateOne({ _id: userId }, { $pull: { pushTokens: { token } } });

/**
 * Fire-and-forget: never throws, so callers can ignore the promise.
 * message: { title, body, data }
 */
const sendPushToUsers = async (userIds, message) => {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return;
    const users = await User.find({ _id: { $in: ids } }).select("+pushTokens").lean();
    const tokens = users.flatMap((u) => (u.pushTokens || []).map((t) => t.token)).filter(isExpoPushToken);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data || {},
      sound: "default",
      priority: "high",
      channelId: message.channelId || "default",
    }));

    // Expo accepts up to 100 messages per request
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      // eslint-disable-next-line no-await-in-loop
      const json = await res.json().catch(() => null);
      const tickets = Array.isArray(json?.data) ? json.data : [];
      // Drop tokens for uninstalled apps so we stop sending to them
      const dead = tickets
        .map((ticket, idx) => (ticket?.details?.error === "DeviceNotRegistered" ? batch[idx].to : null))
        .filter(Boolean);
      if (dead.length) {
        // eslint-disable-next-line no-await-in-loop
        await User.updateMany({}, { $pull: { pushTokens: { token: { $in: dead } } } });
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[push] send failed:", err?.message || err);
  }
};

module.exports = {
  isExpoPushToken,
  registerPushToken,
  removePushToken,
  sendPushToUsers,
};
