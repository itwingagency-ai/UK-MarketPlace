/**
 * Rate limits for unauthenticated auth endpoints (per client IP).
 *
 * - authLimiter: every /api/v1/auth route except refresh/logout, which the apps
 *   call on their own and must not lock a signed-in user out.
 * - otpLimiter / loginLimiter: tighter, counted per IP + email so one abused
 *   account is throttled without locking out everyone behind the same mobile
 *   carrier NAT. Stops OTP flooding, code guessing and password guessing.
 *
 * Counters live in memory: correct for the single API container we run.
 * A second instance would need a shared store (e.g. rate-limit-redis).
 * Behind nginx, app.js sets "trust proxy" so req.ip is the real client.
 */
const rateLimit = require("express-rate-limit");

const WINDOW_MS = 15 * 60 * 1000;

const handler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    message: "Too many attempts. Please wait a few minutes and try again.",
  });
};

const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/refresh" || req.path === "/logout",
  handler,
});

const perAccountKey = (req) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  return `${req.ip}|${email}`;
};

const perAccountLimiter = (limit) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: perAccountKey,
    handler,
  });

const otpLimiter = perAccountLimiter(10);
const loginLimiter = perAccountLimiter(10);

// Signed-in actions that send email or are irreversible: per account
const accountActionLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.id || req.ip}`,
  handler,
});

module.exports = { authLimiter, otpLimiter, loginLimiter, accountActionLimiter };
