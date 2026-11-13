const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const env = require("./config/env");
const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");
const { authenticate } = require("./middleware/auth.middleware");
const { authorize } = require("./middleware/rbac.middleware");
const { resolveStoreScope } = require("./middleware/storeScope.middleware");
const authRoutes = require("./routes/auth.routes");
const protectedRoutes = require("./routes/protected.routes");
const vendorApplicationsApplicantRoutes = require("./routes/vendorApplications.applicant.routes");
const vendorApplicationsAdminRoutes = require("./routes/vendorApplications.admin.routes");
const vendorDashboardRoutes = require("./routes/vendor.dashboard.routes");
const orderTrackingRoutes = require("./routes/orderTracking.routes");
const customerRoutes = require("./routes/customer.routes");
const meRoutes = require("./routes/me.routes");
const cartRoutes = require("./routes/cart.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const paymentRoutes = require("./routes/payment.routes");
const paymentWebhookRoutes = require("./routes/paymentWebhook.routes");
const adminRoutes = require("./routes/admin.routes");
const publicReviewsRoutes = require("./routes/publicReviews.routes");
const productSearchRoutes = require("./routes/productSearch.routes");
const storeDiscoveryRoutes = require("./routes/storeDiscovery.routes");
const { USE_LOCAL_UPLOADS, LOCAL_UPLOAD_DIR } = require("./middleware/upload.middleware");

const app = express();

// Behind nginx in production: trust its X-Forwarded-* headers so req.protocol
// is "https" and uploaded-image URLs aren't built as http:// (mixed content).
if (env.nodeEnv === "production") app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin,
    credentials: true,
  })
);
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// IMPORTANT: Stripe webhook needs the raw body for signature verification.
// Mount it BEFORE express.json() and use express.raw() for this path only.
app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhookRoutes
);

app.use(express.json());
// Local-development image storage (see upload.middleware)
if (USE_LOCAL_UPLOADS) app.use("/uploads", express.static(LOCAL_UPLOAD_DIR));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Server is healthy" });
});

app.get(["/api/v1/platform/settings", "/api/v1/settings"], async (req, res) => {
  try {
    const PlatformSettings = require("./models/PlatformSettings");
    const settings = await PlatformSettings.getOrInit();
    res.status(200).json({ data: settings });
  } catch (error) {
    res.status(500).json({ message: "Error fetching platform settings" });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/protected", protectedRoutes);
app.use("/api/v1/track", orderTrackingRoutes);
app.use("/api/v1/products", productSearchRoutes);  // search + suggest + detail
app.use("/api/v1/products", publicReviewsRoutes);   // /:productId/reviews
app.use("/api/v1/stores", storeDiscoveryRoutes);
app.get(
  "/api/v1/categories",
  require("./controllers/globalCategories.controller").listPublicGlobalCategories
);
app.use(
  "/api/v1/vendor-applications",
  authenticate,
  authorize("customer"),
  vendorApplicationsApplicantRoutes
);
app.use(
  "/api/v1/admin/vendor-applications",
  authenticate,
  authorize("admin"),
  vendorApplicationsAdminRoutes
);
app.use(
  "/api/v1/vendor/dashboard",
  authenticate,
  authorize("vendor", "admin"),
  resolveStoreScope,
  vendorDashboardRoutes
);
app.use("/api/v1/customer", authenticate, customerRoutes);
app.use("/api/v1/me", authenticate, meRoutes);
app.use("/api/v1/cart", authenticate, cartRoutes);
app.use("/api/v1/checkout", authenticate, checkoutRoutes);
app.use("/api/v1/payments", authenticate, paymentRoutes);
app.use("/api/v1/admin", authenticate, authorize("admin"), adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
