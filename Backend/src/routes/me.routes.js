const express = require("express");
const {
  getMyPreferences,
  updateMyPreferences,
} = require("../controllers/userNotificationPreferences.controller");
const { addPushToken, deletePushToken } = require("../controllers/pushTokens.controller");
const { getMyRewards } = require("../controllers/loyalty.controller");

const router = express.Router();

router.get("/notifications/preferences", getMyPreferences);
router.put("/notifications/preferences", updateMyPreferences);
router.post("/push-tokens", addPushToken);
router.get("/rewards", getMyRewards);

// Close account (customers), saved cards
const appPlatform = require("../controllers/appPlatform.controller");
const { accountActionLimiter } = require("../middleware/rateLimit.middleware");

router.post("/account/delete-code", accountActionLimiter, appPlatform.requestAccountDeletion);
router.post("/account/delete", accountActionLimiter, appPlatform.confirmAccountDeletion);
router.get("/payment-methods", appPlatform.listPaymentMethods);
router.post("/payment-methods/setup", require("../controllers/subscriptions.controller").setupCardForRepeatOrders);
router.delete("/payment-methods/:id", appPlatform.removePaymentMethod);
router.delete("/push-tokens", deletePushToken);

module.exports = router;
