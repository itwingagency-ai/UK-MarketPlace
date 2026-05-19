/**
 * storeHours.middleware.js
 *
 * Middleware that blocks order placement if the target store is currently closed.
 *
 * How it works:
 *   1. Reads the store IDs from the cart items (resolved during checkout preview)
 *   2. For each unique store, checks operatingHours + timezone
 *   3. If any store is closed → 409 response with details
 *
 * Usage in routes:
 *   router.post("/checkout", authenticate, requireStoresOpen, placeOrder);
 *
 * Caveats:
 *   - This is a best-effort check at request time. A tiny race between the
 *     check and the order creation is acceptable for a delivery platform.
 *   - Stores with no operatingHours set are always treated as open (not yet configured).
 *   - Can be disabled per-store by setting operatingHours to an empty Map.
 */

const ApiError = require("../lib/ApiError");
const { computeOpenStatus } = require("../lib/geoUtils");
const Store = require("../models/Store");
const Cart = require("../models/Cart");

/**
 * Express middleware.
 * Attaches req.closedStores = [] if all open, or throws 409 if any are closed.
 */
const requireStoresOpen = async (req, res, next) => {
  try {
    // Get the current user's cart to find which stores are involved
    const cart = await Cart.findOne({ user: req.user.id }).lean();
    if (!cart || !cart.items || cart.items.length === 0) {
      return next(); // Empty cart is handled by checkout controller
    }

    // Collect unique store IDs from cart items
    const storeIds = [...new Set(cart.items.map((i) => String(i.store)).filter(Boolean))];
    if (storeIds.length === 0) return next();

    const stores = await Store.find({ _id: { $in: storeIds } }).select(
      "name slug operatingHours timezone status"
    );

    const closedStores = [];

    for (const store of stores) {
      // Skip stores that have not configured hours yet
      const hasHours =
        store.operatingHours &&
        (store.operatingHours instanceof Map
          ? store.operatingHours.size > 0
          : Object.keys(store.operatingHours).length > 0);

      if (!hasHours) continue; // no hours configured → treat as always open

      const timezone = store.timezone || "UTC";
      const status = computeOpenStatus(store.operatingHours, timezone);

      if (!status.isOpen) {
        closedStores.push({
          storeId:     store._id,
          storeName:   store.name,
          storeSlug:   store.slug,
          statusLabel: status.statusLabel,
          nextOpenDay:  status.nextOpenDay,
          nextOpenTime: status.nextOpenTime,
        });
      }
    }

    if (closedStores.length > 0) {
      return next(
        new ApiError(
          409,
          closedStores.length === 1
            ? `${closedStores[0].storeName} is currently closed. ${closedStores[0].statusLabel}`
            : `${closedStores.length} stores in your cart are currently closed`,
          { closedStores }
        )
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { requireStoresOpen };
