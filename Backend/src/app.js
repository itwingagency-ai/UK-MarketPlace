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

const app = express();

app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin,
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Server is healthy" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/protected", protectedRoutes);
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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
