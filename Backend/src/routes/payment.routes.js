const express = require("express");
const {
  getMyTransaction,
  retryPayment,
  cancelTransaction,
  confirmTransaction,
} = require("../controllers/payment.controller");

const router = express.Router();

router.get("/transactions/:transactionId", getMyTransaction);
router.post("/transactions/:transactionId/retry", retryPayment);
router.post("/transactions/:transactionId/cancel", cancelTransaction);
router.post("/transactions/:transactionId/confirm", confirmTransaction);

module.exports = router;
