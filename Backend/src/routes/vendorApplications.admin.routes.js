const express = require("express");
const {
  approveApplication,
  getApplicationById,
  listApplications,
  rejectApplication,
} = require("../controllers/vendorApplicationAdmin.controller");

const router = express.Router();

router.get("/", listApplications);
router.get("/:id", getApplicationById);
router.patch("/:id/reject", rejectApplication);
router.patch("/:id/approve", approveApplication);

module.exports = router;
