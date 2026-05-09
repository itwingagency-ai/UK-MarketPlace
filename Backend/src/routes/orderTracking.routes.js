const express = require("express");
const { trackOrderByNumber } = require("../controllers/orderTracking.controller");

const router = express.Router();

router.get("/:orderNumber", trackOrderByNumber);

module.exports = router;
