const express = require("express");
const upload = require("../middleware/upload.middleware");
const { deliver, getMyOrder, listMyOrders, pickup } = require("../controllers/rider.controller");

const router = express.Router();

router.get("/orders", listMyOrders);
router.get("/orders/:id", getMyOrder);
router.post("/orders/:id/pickup", pickup);
router.post("/orders/:id/deliver", upload.single("photo"), deliver);

module.exports = router;
