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

const {
  createGlobalCategory,
  deleteGlobalCategory,
  listGlobalCategories,
  reorderGlobalCategories,
  updateGlobalCategory,
} = require("../controllers/globalCategories.controller");

const offers = require("../controllers/offersManagement.controller");
const loyaltyAdmin = require("../controllers/loyalty.controller");

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

router.get("/global-categories", listGlobalCategories);
router.post("/global-categories", createGlobalCategory);
router.patch("/global-categories/reorder", reorderGlobalCategories);
router.patch("/global-categories/:id", updateGlobalCategory);
router.delete("/global-categories/:id", deleteGlobalCategory);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

router.get("/commission/summary", commissionSummary);

// Rewards points and referrals
router.get("/loyalty/ledger", loyaltyAdmin.adminLedger);
router.post("/loyalty/adjust", loyaltyAdmin.adminAdjust);
router.get("/referrals", loyaltyAdmin.adminReferrals);
router.patch("/referrals/:id", loyaltyAdmin.adminReviewReferral);

// Coupons and automatic offers (redemptions must stay above /coupons/:id)
router.get("/coupons/redemptions", offers.listRedemptions);
router.get("/coupons", offers.listCoupons);
router.post("/coupons", offers.createCoupon);
router.patch("/coupons/:id", offers.updateCoupon);
router.delete("/coupons/:id", offers.deleteCoupon);
router.get("/promotions", offers.listPromotions);
router.post("/promotions", offers.createPromotion);
router.patch("/promotions/:id", offers.updatePromotion);
router.delete("/promotions/:id", offers.deletePromotion);

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
