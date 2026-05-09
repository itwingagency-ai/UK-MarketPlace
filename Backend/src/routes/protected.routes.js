const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/rbac.middleware");

const router = express.Router();

router.get("/me", authenticate, (req, res) => {
  res.status(200).json({
    message: "Authenticated user profile",
    user: req.user,
  });
});

router.get("/admin", authenticate, authorize("admin"), (req, res) => {
  res.status(200).json({
    message: "Admin route access granted",
  });
});

router.get("/vendor", authenticate, authorize("admin", "vendor"), (req, res) => {
  res.status(200).json({
    message: "Vendor route access granted",
  });
});

module.exports = router;
