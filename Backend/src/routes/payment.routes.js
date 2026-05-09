const express = require("express");
const {
  getMyTransaction,
  retryPayment,
} = require("../controllers/payment.controller");

const router = express.Router();

router.get("/transactions/:transactionId", getMyTransaction);
router.post("/transactions/:transactionId/retry", retryPayment);

module.exports = router;
