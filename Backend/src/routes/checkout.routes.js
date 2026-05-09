const express = require("express");
const {
  placeOrder,
  previewCheckout,
} = require("../controllers/checkout.controller");

const router = express.Router();

router.get("/preview", previewCheckout);
router.post("/", placeOrder);

module.exports = router;
