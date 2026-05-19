const express = require("express");
const {
  placeOrder,
  previewCheckout,
} = require("../controllers/checkout.controller");
const { requireWithinDeliveryZone } = require("../middleware/deliveryZone.middleware");
const { requireStoresOpen } = require("../middleware/storeHours.middleware");

const router = express.Router();

router.get("/preview", previewCheckout);
// Delivery zone + operating hours checks run before order placement
router.post("/", requireWithinDeliveryZone, requireStoresOpen, placeOrder);

module.exports = router;
