/**
 * vendorLocation.controller.js
 *
 * Allows vendors (and admins scoped to a store) to:
 *   GET  /api/v1/vendor/dashboard/location       — view current location config
 *   PATCH /api/v1/vendor/dashboard/location      — set/update location config
 *
 * Accepts:
 *   { address: "EH1 1AA" }            → geocode via Google Maps, save coordinates
 *   { lat: 55.95, lng: -3.19 }        → save coordinates directly (no API call)
 *   { deliveryRadiusKm: 8 }           → update radius only
 *   { operatingHours: { monday: { open:"09:00", close:"22:00", isClosed:false } } }
 *
 * Any combination of the above can be sent in a single request.
 */

const asyncHandler = require("../lib/asyncHandler");
const ApiError = require("../lib/ApiError");
const { geocodeAddress } = require("../lib/geoUtils");
const { validateStoreLocationUpdate } = require("../validators/storeDiscovery.validator");
const Store = require("../models/Store");

const getLocation = asyncHandler(async (req, res) => {
  const storeId = req.storeScopeId;
  if (!storeId) throw new ApiError(400, "No store in scope");

  const store = await Store.findById(storeId).select(
    "name location locationSet deliveryRadiusKm operatingHours address"
  );
  if (!store) throw new ApiError(404, "Store not found");

  res.status(200).json({
    data: {
      locationSet:      store.locationSet,
      coordinates:      store.location?.coordinates || [0, 0],
      deliveryRadiusKm: store.deliveryRadiusKm,
      operatingHours:   store.operatingHours,
      address:          store.address,
    },
  });
});

const updateLocation = asyncHandler(async (req, res) => {
  validateStoreLocationUpdate(req.body);

  const storeId = req.storeScopeId;
  if (!storeId) throw new ApiError(400, "No store in scope");

  const store = await Store.findById(storeId);
  if (!store) throw new ApiError(404, "Store not found");

  const { address, addressDetails, lat, lng, deliveryRadiusKm, operatingHours } = req.body;

  let resolvedLat, resolvedLng, geocodedAddress;

  // Case 1: explicit coordinates from frontend (e.g. Google Places Autocomplete)
  if (lat !== undefined && lng !== undefined) {
    resolvedLat = Number(lat);
    resolvedLng = Number(lng);
  }
  // Case 2: addressDetails object → update store.address and geocode
  else if (addressDetails !== undefined && typeof addressDetails === "object") {
    store.address = {
      line1: addressDetails.line1 || store.address.line1,
      line2: addressDetails.line2 || store.address.line2,
      city: addressDetails.city || store.address.city,
      state: addressDetails.state || store.address.state,
      postalCode: addressDetails.postalCode || store.address.postalCode,
      country: addressDetails.country || store.address.country,
    };
    const addressString = [store.address.line1, store.address.city, store.address.postalCode, store.address.country].filter(Boolean).join(", ");
    const result = await geocodeAddress(addressString);
    resolvedLat = result.lat;
    resolvedLng = result.lng;
    geocodedAddress = result.formattedAddress;
  }
  // Case 3: address string → geocode via Google Maps
  else if (address !== undefined) {
    const result = await geocodeAddress(address);
    resolvedLat = result.lat;
    resolvedLng = result.lng;
    geocodedAddress = result.formattedAddress;

    // Optionally backfill the store's postal code from geocoded address
    // (useful if vendor set address by typing rather than selecting)
  }

  // Apply coordinate update
  if (resolvedLat !== undefined && resolvedLng !== undefined) {
    store.location = {
      type: "Point",
      coordinates: [resolvedLng, resolvedLat], // GeoJSON: [lng, lat]
    };
    store.locationSet = true;
  }

  // Apply radius update
  if (deliveryRadiusKm !== undefined) {
    store.deliveryRadiusKm = Number(deliveryRadiusKm);
  }

  // Apply operating hours (merge — don't overwrite days not provided)
  if (operatingHours !== undefined) {
    const currentHours = store.operatingHours || new Map();
    for (const [day, slot] of Object.entries(operatingHours)) {
      const existing = currentHours.get ? currentHours.get(day) : currentHours[day];
      currentHours.set
        ? currentHours.set(day, { ...(existing || {}), ...slot })
        : (currentHours[day] = { ...(existing || {}), ...slot });
    }
    store.operatingHours = currentHours;
  }

  await store.save();

  res.status(200).json({
    message: "Store location updated",
    data: {
      locationSet:      store.locationSet,
      coordinates:      store.location.coordinates,
      deliveryRadiusKm: store.deliveryRadiusKm,
      operatingHours:   store.operatingHours,
      ...(geocodedAddress ? { geocodedAddress } : {}),
    },
  });
});

module.exports = { getLocation, updateLocation };
