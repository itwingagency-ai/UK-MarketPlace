const express = require("express");
const {
  addAddress,
  changePassword,
  deleteAddress,
  getMe,
  listAddresses,
  updateAddress,
  updateMe,
} = require("../controllers/customerProfile.controller");
const {
  getMyOrderById,
  getMyOrderHistory,
  listMyOrders,
} = require("../controllers/customerOrders.controller");
const {
  checkEligibility,
  deleteMyReview,
  listMyReviews,
  reportReview,
  submitReview,
  toggleHelpful,
  updateMyReview,
} = require("../controllers/customerReviews.controller");

const router = express.Router();

router.get("/me", getMe);
router.patch("/me", updateMe);
router.patch("/me/password", changePassword);

router.get("/me/addresses", listAddresses);
router.post("/me/addresses", addAddress);
router.patch("/me/addresses/:id", updateAddress);
router.delete("/me/addresses/:id", deleteAddress);

router.get("/orders", listMyOrders);
router.get("/orders/:id", getMyOrderById);
router.get("/orders/:id/history", getMyOrderHistory);

router.get("/reviews", listMyReviews);
router.get("/products/:productId/reviews/eligibility", checkEligibility);
router.post("/products/:productId/reviews", submitReview);
router.patch("/reviews/:id", updateMyReview);
router.delete("/reviews/:id", deleteMyReview);
router.post("/reviews/:id/helpful", toggleHelpful);
router.post("/reviews/:id/report", reportReview);

module.exports = router;
