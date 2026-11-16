/**
 * Error reporting (Sentry). Off unless SENTRY_DSN is set (plan §5: ship
 * disabled until a key is supplied). Only 5xx errors are reported; request
 * bodies, cookies and auth headers are never sent.
 */
let Sentry = null;

const initMonitoring = () => {
  const dsn = (process.env.SENTRY_DSN || "").trim();
  if (!dsn || Sentry) return Boolean(Sentry);
  // eslint-disable-next-line global-require
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
  return true;
};

const reportError = (err, req) => {
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    if (req) {
      scope.setTag("route", `${req.method} ${req.baseUrl || ""}${req.route?.path || req.path}`);
      if (req.user?.id) scope.setUser({ id: String(req.user.id) });
    }
    Sentry.captureException(err);
  });
};

module.exports = { initMonitoring, reportError };
