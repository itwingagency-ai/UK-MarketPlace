const express = require("express");
const {
  addItem,
  applyCoupon,
  removeCoupon,
  setCartOptions,
  setFulfilment,
  setTip,
  clearCart,
  getCart,
  removeItem,
  updateItemQuantity,
} = require("../controllers/cart.controller");

const router = express.Router();

router.get("/", getCart);
router.post("/items", addItem);
router.patch("/items/:itemId", updateItemQuantity);
router.delete("/items/:itemId", removeItem);
router.delete("/", clearCart);
router.post("/coupon", applyCoupon);
router.delete("/coupon/:code", removeCoupon);
router.put("/tip", setTip);
router.put("/options", setCartOptions);
router.put("/fulfilment", setFulfilment);

module.exports = router;
