const express = require("express");
const { getOverview } = require("../controllers/vendorDashboard.controller");
const { getLocation, updateLocation } = require("../controllers/vendorLocation.controller");
const {
  getOperatingHours,
  getLiveStatus,
  replaceOperatingHours,
  updateDay,
  closeDay,
} = require("../controllers/vendorOperatingHours.controller");
const {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  restoreProduct,
  updateProduct,
} = require("../controllers/vendorProducts.controller");
const {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} = require("../controllers/vendorCategories.controller");
const {
  addShipmentEvent,
  getOrderById,
  getOrderHistory,
  listOrders,
  listShipmentEvents,
  updateOrderStatus,
} = require("../controllers/vendorOrders.controller");
const {
  createShippingMethod,
  deleteShippingMethod,
  getShippingMethod,
  listShippingMethods,
  updateShippingMethod,
} = require("../controllers/vendorShippingMethods.controller");
const {
  clearVendorResponse,
  getReview: getVendorReview,
  hideReview,
  listReviews: listVendorReviews,
  reviewStats: vendorReviewStats,
  setVendorResponse,
  unhideReview,
} = require("../controllers/vendorReviews.controller");
const { markCodCollected } = require("../controllers/payment.controller");
const {
  getCommissionLedger,
  getCommissionSummary,
  previewCommission,
} = require("../controllers/vendorCommission.controller");
const {
  categoryBreakdown,
  customerInsights,
  orderBreakdown,
  overview: analyticsOverview,
  productPerformance,
  salesTrend,
  topProducts: analyticsTopProducts,
} = require("../controllers/vendorAnalytics.controller");
const {
  productPerformanceReport,
  salesReport,
} = require("../controllers/vendorReports.controller");
const {
  getSettings,
  updateSettings,
} = require("../controllers/vendorSettings.controller");
const { requireResourceInScope } = require("../middleware/storeScope.middleware");
const Category = require("../models/Category");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");
const ShippingMethod = require("../models/ShippingMethod");

const router = express.Router();

router.get("/overview", getOverview);

router.get("/products", listProducts);
router.post("/products", createProduct);
router.get("/products/:id", requireResourceInScope(Product), getProductById);
router.patch("/products/:id", requireResourceInScope(Product), updateProduct);
router.delete("/products/:id", requireResourceInScope(Product), deleteProduct);
router.patch(
  "/products/:id/restore",
  requireResourceInScope(Product),
  restoreProduct
);

router.get("/categories", listCategories);
router.post("/categories", createCategory);
router.get(
  "/categories/:id",
  requireResourceInScope(Category),
  getCategoryById
);
router.patch(
  "/categories/:id",
  requireResourceInScope(Category),
  updateCategory
);
router.delete(
  "/categories/:id",
  requireResourceInScope(Category),
  deleteCategory
);

router.get("/orders", listOrders);
router.get("/orders/:id", requireResourceInScope(Order), getOrderById);
router.get(
  "/orders/:id/history",
  requireResourceInScope(Order),
  getOrderHistory
);
router.patch(
  "/orders/:id/status",
  requireResourceInScope(Order),
  updateOrderStatus
);
router.patch(
  "/orders/:id/payment",
  requireResourceInScope(Order),
  markCodCollected
);
router.get(
  "/orders/:id/tracking/events",
  requireResourceInScope(Order),
  listShipmentEvents
);
router.post(
  "/orders/:id/tracking/events",
  requireResourceInScope(Order),
  addShipmentEvent
);

router.get("/shipping-methods", listShippingMethods);
router.post("/shipping-methods", createShippingMethod);
router.get(
  "/shipping-methods/:id",
  requireResourceInScope(ShippingMethod),
  getShippingMethod
);
router.patch(
  "/shipping-methods/:id",
  requireResourceInScope(ShippingMethod),
  updateShippingMethod
);
router.delete(
  "/shipping-methods/:id",
  requireResourceInScope(ShippingMethod),
  deleteShippingMethod
);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

router.get("/commission/summary", getCommissionSummary);
router.get("/commission/ledger", getCommissionLedger);
router.get("/commission/preview", previewCommission);

router.get("/analytics/overview", analyticsOverview);
router.get("/analytics/sales-trend", salesTrend);
router.get("/analytics/top-products", analyticsTopProducts);
router.get("/analytics/order-breakdown", orderBreakdown);
router.get("/analytics/customers", customerInsights);
router.get("/analytics/category-breakdown", categoryBreakdown);
router.get("/analytics/products/:productId", productPerformance);

router.get("/reports/sales", salesReport);
router.get("/reports/products", productPerformanceReport);

router.get("/reviews/stats", vendorReviewStats);
router.get("/reviews", listVendorReviews);
router.get("/reviews/:id", requireResourceInScope(Review), getVendorReview);
router.post(
  "/reviews/:id/response",
  requireResourceInScope(Review),
  setVendorResponse
);
router.delete(
  "/reviews/:id/response",
  requireResourceInScope(Review),
  clearVendorResponse
);
router.patch(
  "/reviews/:id/hide",
  requireResourceInScope(Review),
  hideReview
);
router.patch(
  "/reviews/:id/unhide",
  requireResourceInScope(Review),
  unhideReview
);

router.get("/location", getLocation);
router.patch("/location", updateLocation);

// ── Operating Hours ─────────────────────────────────────────────────────────
// status must be registered before /:day to avoid shadowing
router.get("/operating-hours/status", getLiveStatus);
router.get("/operating-hours", getOperatingHours);
router.put("/operating-hours", replaceOperatingHours);
router.patch("/operating-hours/:day", updateDay);
router.delete("/operating-hours/:day", closeDay);

module.exports = router;
