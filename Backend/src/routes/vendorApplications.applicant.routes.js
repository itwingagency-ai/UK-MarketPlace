const express = require("express");
const {
  getMyLatestApplication,
  submitApplication,
} = require("../controllers/vendorApplicationApplicant.controller");

const router = express.Router();

router.post("/", submitApplication);
router.get("/me", getMyLatestApplication);

module.exports = router;
