/**
 * storeDiscovery.controller.js
 *
 * Public (unauthenticated) endpoints for:
 *   GET /api/v1/stores/nearby   — find stores that can deliver to a location
 *   GET /api/v1/stores/:slug    — public profile of a single store
 *   GET /api/v1/stores/:storeId/products — browse products for a given store
 *
 * Flow for /nearby:
 *   1. Accept ?address=... OR ?lat=&lng=
 *   2. If address → geocode via Google Maps API → { lat, lng }
 *   3. Query MongoDB with $nearSphere against stores with locationSet=true, status=active
 *      Each store has its own deliveryRadiusKm; we filter post-query to only keep
 *      stores whose deliveryRadiusKm >= distance from the customer.
 *   4. Annotate results with distanceKm and open/closed status
 */

const asyncHandler = require("../lib/asyncHandler");
const ApiError = require("../lib/ApiError");
const {
  geocodeAddress,
  isValidLatLng,
  buildNearQuery,
  haversineKm,
  computeOpenStatus,
} = require("../lib/geoUtils");
const { validateNearbyQuery } = require("../validators/storeDiscovery.validator");
const Store = require("../models/Store");
const Product = require("../models/Product");
const Category = require("../models/Category");

// How far we cast the initial MongoDB net (km).
// We then filter per-store by each store's own deliveryRadiusKm.
// Casting a wider net in one query is more efficient than N queries.
const MAX_SEARCH_RADIUS_KM = 100;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract pagination params from query, apply safe defaults and caps.
 */
const parsePagination = (query) => {
  const page  = Math.max(Number(query.page)  || 1,  1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Build the public-facing shape of a store document.
 */
const formatStore = (store, distanceKm, status) => ({
  id:               store._id,
  name:             store.name,
  slug:             store.slug,
  status:           store.status,
  contact:          store.contact,
  address:          store.address,
  deliveryRadiusKm: store.deliveryRadiusKm,
  distanceKm,
  isOpen:           status.isOpen,
  statusLabel:      status.statusLabel,
  opensAt:          status.opensAt,
  closesAt:         status.closesAt,
  nextOpenDay:      status.nextOpenDay,
  nextOpenTime:     status.nextOpenTime,
  todayHours:       status.todayHours,
  branding:         store.branding || null,
});

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/stores/nearby
 *
 * Query params:
 *   address   — any address / postcode (geocoded via Google Maps)
 *   lat, lng  — raw coordinates (skips geocoding — use when frontend has them already)
 *   radius    — optional cap in km (defaults to each store's own deliveryRadiusKm)
 *   limit     — results per page (max 50, default 20)
 *   page      — page number
 *   timezone  — IANA timezone string for open/closed status (default "UTC")
 */
const getNearbyStores = asyncHandler(async (req, res) => {
  validateNearbyQuery(req.query);

  const {
    address,
    lat: rawLat,
    lng: rawLng,
    radius: rawRadius,
    timezone = "UTC",
  } = req.query;

  let lat, lng, geocodedAddress;

  // Step 1 — resolve coordinates
  if (rawLat !== undefined && rawLng !== undefined) {
    // Frontend already has coordinates (e.g. from Google Places Autocomplete)
    lat = Number(rawLat);
    lng = Number(rawLng);
  } else {
    // Geocode the address via Google Maps API
    const result = await geocodeAddress(address);
    lat = result.lat;
    lng = result.lng;
    geocodedAddress = result.formattedAddress;
  }

  // Optional client-supplied radius cap
  const clientRadiusCap = rawRadius ? Number(rawRadius) : null;
  // Cast a wide net — MongoDB sorts by distance automatically with $nearSphere
  const searchRadius = clientRadiusCap
    ? Math.min(clientRadiusCap, MAX_SEARCH_RADIUS_KM)
    : MAX_SEARCH_RADIUS_KM;

  // Step 2 — MongoDB geo query
  // $nearSphere returns documents sorted nearest → furthest and filters by maxDistance
  const geoFilter = buildNearQuery(lng, lat, searchRadius);

  const candidates = await Store.find({
    ...geoFilter,
    status: "active",
    locationSet: true,
  }).select(
    "name slug status contact address location deliveryRadiusKm operatingHours branding"
  );
  // Note: skip/limit cannot be used with $nearSphere in all MongoDB drivers reliably
  // for large sets; we post-filter and paginate in memory (candidate count is small
  // because deliveryRadiusKm caps are typically ≤ 30 km).

  // Step 3 — post-filter by each store's own deliveryRadiusKm
  const { page, limit, skip } = parsePagination(req.query);

  const eligible = [];
  for (const store of candidates) {
    const [storeLng, storeLat] = store.location.coordinates;
    const dist = haversineKm(lat, lng, storeLat, storeLng);

    // Customer is within this store's delivery zone?
    const effectiveRadius = clientRadiusCap
      ? Math.min(store.deliveryRadiusKm, clientRadiusCap)
      : store.deliveryRadiusKm;

    if (dist <= effectiveRadius) {
      const status = computeOpenStatus(store.operatingHours, timezone);
      eligible.push({ store, dist, status });
    }
  }

  // Step 4 — paginate
  const total = eligible.length;
  const pageSlice = eligible.slice(skip, skip + limit);

  res.status(200).json({
    data: {
      resolvedLocation: geocodedAddress
        ? { lat, lng, formattedAddress: geocodedAddress }
        : { lat, lng },
      page,
      limit,
      total,
      stores: pageSlice.map(({ store, dist, status }) =>
        formatStore(store, dist, status)
      ),
    },
  });
});

/**
 * GET /api/v1/stores/:slug
 *
 * Public profile for a single store. Looks up by slug (URL-friendly identifier).
 * Returns store info, operating hours, and open/closed status.
 */
const getStoreBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const store = await Store.findOne({ slug: slug.toLowerCase(), status: "active" }).select(
    "name slug status contact address location deliveryRadiusKm operatingHours branding"
  );

  if (!store) throw new ApiError(404, "Store not found");

  const timezone = req.query.timezone || "UTC";
  const status = computeOpenStatus(store.operatingHours, timezone);

  res.status(200).json({
    data: {
      ...formatStore(store, null, status),
      weekSchedule: status.weekSchedule,
    },
  });
});

/**
 * GET /api/v1/stores/:storeId/products
 *
 * Browse active products for a given store (by store ID or slug).
 * Supports filtering by category and pagination.
 *
 * Query params:
 *   category  — category ID or slug to filter by
 *   limit     — page size (default 20, max 50)
 *   page      — page number
 *   sort      — "price_asc" | "price_desc" | "newest" | "rating" (default "newest")
 */
const getStoreProducts = asyncHandler(async (req, res) => {
  const { storeId } = req.params;

  // Accept either a MongoDB ObjectId or a store slug
  let store;
  if (/^[a-f\d]{24}$/i.test(storeId)) {
    store = await Store.findOne({ _id: storeId, status: "active" }).select("_id name slug");
  } else {
    store = await Store.findOne({ slug: storeId.toLowerCase(), status: "active" }).select("_id name slug");
  }

  if (!store) throw new ApiError(404, "Store not found");

  const { page, limit, skip } = parsePagination(req.query);

  // Build product filter
  const filter = { store: store._id, isActive: true };

  // Optional category filter
  if (req.query.category) {
    let cat;
    if (/^[a-f\d]{24}$/i.test(req.query.category)) {
      cat = await Category.findOne({ _id: req.query.category, store: store._id, isActive: true });
    } else {
      cat = await Category.findOne({
        slug: req.query.category.toLowerCase(),
        store: store._id,
        isActive: true,
      });
    }
    if (!cat) throw new ApiError(404, "Category not found in this store");
    filter.category = cat._id;
  }

  // Sort mapping
  const SORT_OPTIONS = {
    price_asc:  { price: 1 },
    price_desc: { price: -1 },
    newest:     { createdAt: -1 },
    rating:     { averageRating: -1, ratingCount: -1 },
  };
  const sortKey = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.newest;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortKey)
      .skip(skip)
      .limit(limit)
      .populate("category", "name slug")
      .select(
        "title slug price compareAtPrice stock images averageRating ratingCount isActive category variants"
      ),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    data: {
      store: { id: store._id, name: store.name, slug: store.slug },
      page,
      limit,
      total,
      products,
    },
  });
});

/**
 * GET /api/v1/stores/:slug/status
 *
 * Lightweight public endpoint for polling live open/closed status.
 * Used by the frontend for real-time "Open Now" badge updates.
 * Returns full weekSchedule for the hours panel.
 */
const getStoreStatus = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const store = await Store.findOne({ slug: slug.toLowerCase(), status: "active" })
    .select("name slug operatingHours timezone");

  if (!store) throw new ApiError(404, "Store not found");

  const timezone = store.timezone || req.query.timezone || "UTC";
  const status = computeOpenStatus(store.operatingHours, timezone);

  res.status(200).json({
    data: {
      storeSlug:         store.slug,
      storeName:         store.name,
      isOpen:            status.isOpen,
      statusLabel:       status.statusLabel,
      todayDay:          status.todayDay,
      todayHours:        status.todayHours,
      opensAt:           status.opensAt,
      closesAt:          status.closesAt,
      minutesUntilOpen:  status.minutesUntilOpen,
      minutesUntilClose: status.minutesUntilClose,
      nextOpenDay:       status.nextOpenDay,
      nextOpenTime:      status.nextOpenTime,
      weekSchedule:      status.weekSchedule,
      timezone,
      asOf:              new Date().toISOString(),
    },
  });
});

/**
 * GET /api/v1/stores/:slug/delivers
 *
 * Check whether a specific store delivers to a given address / coordinates.
 * Used by the frontend before the customer starts adding items to cart.
 *
 * Query params:
 *   address  — postcode or street address (geocoded via Google Maps)
 *   lat, lng — raw coordinates
 *
 * Response:
 *   { delivers: true/false, distanceKm, deliveryRadiusKm, ... }
 */
const checkDeliverability = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { address, lat: rawLat, lng: rawLng } = req.query;

  // Validate input
  const hasAddress = address && String(address).trim().length > 0;
  const hasLatLng  = rawLat !== undefined && rawLng !== undefined;

  if (!hasAddress && !hasLatLng) {
    throw new ApiError(400, "Provide 'address' or 'lat' + 'lng' query params");
  }

  // Resolve coordinates
  let lat, lng, formattedAddress;
  if (hasLatLng) {
    lat = Number(rawLat);
    lng = Number(rawLng);
    if (!isValidLatLng(lat, lng)) {
      throw new ApiError(400, "lat must be -90..90 and lng must be -180..180");
    }
  } else {
    const result = await geocodeAddress(address);
    lat = result.lat;
    lng = result.lng;
    formattedAddress = result.formattedAddress;
  }

  // Find store
  const store = await Store.findOne({
    slug: slug.toLowerCase(),
    status: "active",
  }).select("name slug location locationSet deliveryRadiusKm");

  if (!store) throw new ApiError(404, "Store not found");

  if (!store.locationSet) {
    // Store hasn't configured its location — cannot verify delivery zone
    return res.status(200).json({
      data: {
        delivers:         null,
        reason:           "Store has not configured its delivery zone yet",
        storeName:        store.name,
        storeSlug:        store.slug,
        deliveryRadiusKm: store.deliveryRadiusKm,
        distanceKm:       null,
        resolvedAddress:  formattedAddress || null,
      },
    });
  }

  const [storeLng, storeLat] = store.location.coordinates;
  const distKm = haversineKm(lat, lng, storeLat, storeLng);
  const delivers = distKm <= store.deliveryRadiusKm;

  res.status(200).json({
    data: {
      delivers,
      distanceKm:       distKm,
      deliveryRadiusKm: store.deliveryRadiusKm,
      exceededByKm:     delivers ? null : Number((distKm - store.deliveryRadiusKm).toFixed(2)),
      storeName:        store.name,
      storeSlug:        store.slug,
      resolvedAddress:  formattedAddress || null,
      customerLocation: { lat, lng },
      storeLocation:    { lat: storeLat, lng: storeLng },
    },
  });
});

module.exports = {
  getNearbyStores,
  getStoreBySlug,
  getStoreStatus,
  getStoreProducts,
  checkDeliverability,
};
