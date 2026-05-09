const express = require("express");
const {
  getMyPreferences,
  updateMyPreferences,
} = require("../controllers/userNotificationPreferences.controller");

const router = express.Router();

router.get("/notifications/preferences", getMyPreferences);
router.put("/notifications/preferences", updateMyPreferences);

module.exports = router;
