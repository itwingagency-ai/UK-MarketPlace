const express = require("express");
const {
  overview,
  recentActivity,
  salesAnalytics,
  topStores,
} = require("../controllers/adminDashboard.controller");
const {
  getUserById,
  listUsers,
  reactivateUser,
  suspendUser,
  updateUser,
} = require("../controllers/adminUsers.controller");
const {
  getStoreById,
  listStores,
  reactivateStore,
  suspendStore,
  updateStore,
} = require("../controllers/adminStores.controller");
const {
  getOrderById,
  listAllOrders,
} = require("../controllers/adminOrders.controller");
const {
  commissionSummary,
  getSettings,
  setStoreCommission,
  updateSettings,
} = require("../controllers/adminSettings.controller");
const {
  deleteTemplate,
  getTemplate,
  listTemplates,
  upsertTemplate,
} = require("../controllers/adminNotificationTemplates.controller");
const {
  getNotification,
  listNotifications,
} = require("../controllers/adminNotificationLog.controller");
const {
  deleteReview: adminDeleteReview,
  getReview: adminGetReview,
  listReports: adminListReviewReports,
  listReviews: adminListReviews,
  resolveReport: adminResolveReviewReport,
  updateStatus: adminUpdateReviewStatus,
} = require("../controllers/adminReviews.controller");

const router = express.Router();

router.get("/overview", overview);
router.get("/activity", recentActivity);
router.get("/analytics/sales", salesAnalytics);
router.get("/analytics/top-stores", topStores);

router.get("/users", listUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/suspend", suspendUser);
router.patch("/users/:id/reactivate", reactivateUser);

router.get("/stores", listStores);
router.get("/stores/:id", getStoreById);
router.patch("/stores/:id", updateStore);
router.patch("/stores/:id/suspend", suspendStore);
router.patch("/stores/:id/reactivate", reactivateStore);
router.patch("/stores/:storeId/commission", setStoreCommission);

router.get("/orders", listAllOrders);
router.get("/orders/:id", getOrderById);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

router.get("/commission/summary", commissionSummary);

router.get("/notifications/templates", listTemplates);
router.get("/notifications/templates/:eventType/:channel", getTemplate);
router.put("/notifications/templates/:eventType/:channel", upsertTemplate);
router.delete("/notifications/templates/:eventType/:channel", deleteTemplate);

router.get("/notifications/log", listNotifications);
router.get("/notifications/log/:id", getNotification);

router.get("/reviews/reports", adminListReviewReports);
router.patch("/reviews/reports/:id", adminResolveReviewReport);
router.get("/reviews", adminListReviews);
router.get("/reviews/:id", adminGetReview);
router.patch("/reviews/:id/status", adminUpdateReviewStatus);
router.delete("/reviews/:id", adminDeleteReview);

module.exports = router;
