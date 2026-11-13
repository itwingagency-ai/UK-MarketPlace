const express = require("express");
const {
  getMyPreferences,
  updateMyPreferences,
} = require("../controllers/userNotificationPreferences.controller");
const { addPushToken, deletePushToken } = require("../controllers/pushTokens.controller");

const router = express.Router();

router.get("/notifications/preferences", getMyPreferences);
router.put("/notifications/preferences", updateMyPreferences);
router.post("/push-tokens", addPushToken);
router.delete("/push-tokens", deletePushToken);

module.exports = router;
