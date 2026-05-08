const express = require("express");
const { getOverview } = require("../controllers/vendorDashboard.controller");
const {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} = require("../controllers/vendorProducts.controller");
const {
  getOrderById,
  listOrders,
  updateOrderStatus,
} = require("../controllers/vendorOrders.controller");
const { getSettings, updateSettings } = require("../controllers/vendorSettings.controller");
const { requireResourceInScope } = require("../middleware/storeScope.middleware");
const Order = require("../models/Order");
const Product = require("../models/Product");

const router = express.Router();

router.get("/overview", getOverview);

router.get("/products", listProducts);
router.post("/products", createProduct);
router.patch("/products/:id", requireResourceInScope(Product), updateProduct);
router.delete("/products/:id", requireResourceInScope(Product), deleteProduct);

router.get("/orders", listOrders);
router.get("/orders/:id", requireResourceInScope(Order), getOrderById);
router.patch(
  "/orders/:id/status",
  requireResourceInScope(Order),
  updateOrderStatus
);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

module.exports = router;
