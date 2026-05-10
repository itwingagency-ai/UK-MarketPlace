const express = require("express");
const {
  addItem,
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

module.exports = router;
