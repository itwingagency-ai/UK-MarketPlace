const express = require("express");
const {
  getProductReviewStats,
  listProductReviews,
} = require("../controllers/publicReviews.controller");

const router = express.Router();

router.get("/:productId/reviews", listProductReviews);
router.get("/:productId/reviews/stats", getProductReviewStats);

module.exports = router;
