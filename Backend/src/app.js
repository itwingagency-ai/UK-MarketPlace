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
<<<<<<< HEAD
=======
const orderTrackingRoutes = require("./routes/orderTracking.routes");
const customerRoutes = require("./routes/customer.routes");
const meRoutes = require("./routes/me.routes");
const cartRoutes = require("./routes/cart.routes");
const checkoutRoutes = require("./routes/checkout.routes");
const paymentRoutes = require("./routes/payment.routes");
const paymentWebhookRoutes = require("./routes/paymentWebhook.routes");
const adminRoutes = require("./routes/admin.routes");
const publicReviewsRoutes = require("./routes/publicReviews.routes");
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81

const app = express();

app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin,
    credentials: true,
  })
);
app.use(morgan("dev"));
<<<<<<< HEAD
=======

// IMPORTANT: Stripe webhook needs the raw body for signature verification.
// Mount it BEFORE express.json() and use express.raw() for this path only.
app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhookRoutes
);

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Server is healthy" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/protected", protectedRoutes);
<<<<<<< HEAD
=======
app.use("/api/v1/track", orderTrackingRoutes);
app.use("/api/v1/products", publicReviewsRoutes);
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
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
<<<<<<< HEAD
=======
app.use("/api/v1/customer", authenticate, customerRoutes);
app.use("/api/v1/me", authenticate, meRoutes);
app.use("/api/v1/cart", authenticate, cartRoutes);
app.use("/api/v1/checkout", authenticate, checkoutRoutes);
app.use("/api/v1/payments", authenticate, paymentRoutes);
app.use("/api/v1/admin", authenticate, authorize("admin"), adminRoutes);
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
