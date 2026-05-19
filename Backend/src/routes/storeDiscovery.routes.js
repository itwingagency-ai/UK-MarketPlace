const express = require("express");
const {
  getNearbyStores,
  getStoreBySlug,
  getStoreStatus,
  getStoreProducts,
  checkDeliverability,
} = require("../controllers/storeDiscovery.controller");

const router = express.Router();

/**
 * Public store discovery routes — no authentication required.
 *
 * GET /api/v1/stores/nearby
 *   Find stores that deliver to a given address or coordinates.
 *
 * GET /api/v1/stores/:slug/status
 *   Live open/closed status + full week schedule for a store.
 *
 * GET /api/v1/stores/:slug/delivers
 *   Check if a store delivers to a specific address / coordinates.
 *   Query: address | (lat + lng)
 *
 * GET /api/v1/stores/:slug
 *   Full public profile for a single store.
 *
 * GET /api/v1/stores/:storeId/products
 *   Browse products for a store. storeId can be a Mongo ObjectId or slug.
 *
 * NOTE: Sub-routes (status, delivers, products) must come BEFORE ":slug"
 *       to avoid Express treating literal paths as slug params.
 */
router.get("/nearby", getNearbyStores);
router.get("/:slug/status", getStoreStatus);
router.get("/:slug/delivers", checkDeliverability);
router.get("/:slug/products", getStoreProducts);
router.get("/:slug", getStoreBySlug);

module.exports = router;
