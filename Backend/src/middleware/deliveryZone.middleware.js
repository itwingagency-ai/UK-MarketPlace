/**
 * deliveryZone.middleware.js
 *
 * Middleware that validates the customer's shipping address is within the
 * delivery zone of every store in their cart at checkout time.
 *
 * Flow:
 *   1. Resolves customer's shipping address to coordinates
 *      - If customer provided lat/lng → use directly
 *      - If customer provided addressId → look up from user profile, geocode
 *      - If customer provided shippingAddress.postalCode → geocode
 *   2. For each unique store in the cart, compute the Haversine distance
 *   3. If distance > store.deliveryRadiusKm → reject with 409
 *
 * Placement: runs BEFORE placeOrder in the checkout route.
 */

const ApiError = require("../lib/ApiError");
const { geocodeAddress, haversineKm, isValidLatLng } = require("../lib/geoUtils");
const Store = require("../models/Store");
const Cart = require("../models/Cart");
const User = require("../models/User");

/**
 * Resolve the customer's delivery coordinates from the request body.
 *
 * Priority:
 *   1. body.lat + body.lng (frontend already has coordinates)
 *   2. body.addressId → look up user's saved address → geocode
 *   3. body.shippingAddress → combine into string → geocode
 *
 * Returns { lat, lng } or null if no address information provided.
 */
const resolveCustomerCoords = async (body, userId) => {
  // Direct coordinates (e.g. from Google Places Autocomplete on frontend)
  if (body.lat !== undefined && body.lng !== undefined) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // Saved address ID
  if (body.addressId && userId) {
    const user = await User.findById(userId).select("addresses");
    if (user) {
      const addr = user.addresses.id(body.addressId);
      if (addr) {
        const parts = [addr.line1, addr.city, addr.postalCode, addr.country]
          .filter(Boolean)
          .join(", ");
        if (parts.length > 0) {
          const result = await geocodeAddress(parts);
          return { lat: result.lat, lng: result.lng };
        }
      }
    }
  }

  // Inline shipping address
  if (body.shippingAddress && typeof body.shippingAddress === "object") {
    const a = body.shippingAddress;
    const parts = [a.line1, a.city, a.postalCode, a.country]
      .filter(Boolean)
      .join(", ");
    if (parts.length > 0) {
      const result = await geocodeAddress(parts);
      return { lat: result.lat, lng: result.lng };
    }
  }

  return null;
};

/**
 * Express middleware — attach to checkout route before placeOrder.
 *
 * On success: sets req.deliveryCoords = { lat, lng } for downstream use.
 * On failure: throws 409 with a list of out-of-range stores.
 */
const requireWithinDeliveryZone = async (req, res, next) => {
  try {
    // Step 1 — Resolve customer coordinates
    const coords = await resolveCustomerCoords(req.body, req.user?.id);

    // If we can't determine customer location, skip the check
    // (the order will still succeed — this is a soft enforcement).
    if (!coords) return next();

    req.deliveryCoords = coords;

    // Step 2 — Collect unique store IDs from the cart
    const cart = await Cart.findOne({ user: req.user.id }).lean();
    if (!cart || !cart.items || cart.items.length === 0) return next();

    const storeIds = [
      ...new Set(cart.items.map((i) => String(i.store)).filter(Boolean)),
    ];
    if (storeIds.length === 0) return next();

    // Step 3 — Fetch stores with location data
    const stores = await Store.find({
      _id: { $in: storeIds },
      status: "active",
    }).select("name slug location locationSet deliveryRadiusKm");

    // Step 4 — Check each store
    const outOfRange = [];

    for (const store of stores) {
      // Skip stores that haven't configured a location yet
      if (!store.locationSet) continue;

      const [storeLng, storeLat] = store.location.coordinates;
      const distKm = haversineKm(coords.lat, coords.lng, storeLat, storeLng);

      if (distKm > store.deliveryRadiusKm) {
        outOfRange.push({
          storeId:          store._id,
          storeName:        store.name,
          storeSlug:        store.slug,
          deliveryRadiusKm: store.deliveryRadiusKm,
          distanceKm:       distKm,
          exceededByKm:     Number((distKm - store.deliveryRadiusKm).toFixed(2)),
        });
      }
    }

    if (outOfRange.length > 0) {
      const storeNames = outOfRange.map((s) => s.storeName).join(", ");
      const err = new ApiError(
        409,
        outOfRange.length === 1
          ? `${outOfRange[0].storeName} does not deliver to your address (${outOfRange[0].distanceKm} km away, max delivery radius is ${outOfRange[0].deliveryRadiusKm} km)`
          : `${outOfRange.length} stores do not deliver to your address: ${storeNames}`
      );
      err.details = { outOfRange };
      return next(err);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { requireWithinDeliveryZone };
