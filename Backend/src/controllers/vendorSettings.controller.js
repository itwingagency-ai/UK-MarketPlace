const asyncHandler = require("../lib/asyncHandler");
const ApiError = require("../lib/ApiError");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Store = require("../models/Store");
const StoreSettings = require("../models/StoreSettings");
const { validateSettingsPayload } = require("../validators/store.validator");
const { deleteFileFromS3 } = require("../lib/s3Utils");
const { DEFAULT_FULFILMENT, fulfilmentOf } = require("../lib/slots");
const { validateFulfilmentSettings } = require("../validators/fulfilment.validator");

const getSettings = asyncHandler(async (req, res) => {
  const storeId = resolveTargetStoreId(req);

  const [store, settings] = await Promise.all([
    Store.findById(storeId),
    StoreSettings.findOne({ store: storeId }),
  ]);

  if (!store) {
    throw new ApiError(404, "Store not found");
  }

  const result = {
    storeName: store.name || "",
    slug: store.slug || "",
    description: store.description || "",
    logoUrl: settings?.branding?.logoUrl || "",
    bannerUrl: settings?.branding?.bannerUrl || "",
    bannerUploadedAt: settings?.branding?.bannerUploadedAt || null,
    contactEmail: store.contact?.email || "",
    contactPhone: store.contact?.phone || "",
    // Retain other nested settings objects so frontend doesn't break if accessed elsewhere
    branding: settings?.branding || { displayName: store.name, logoUrl: "", themeColor: "" },
    businessHours: settings?.businessHours || "",
    policies: settings?.policies || { returnPolicy: "", shippingPolicy: "" },
    notifications: settings?.notifications || { emailEnabled: true, smsEnabled: false, whatsappEnabled: false },
    shipping: settings?.shipping || { flatFee: 0, freeShippingThreshold: 0 },
    // Pence. Baskets below this (goods, before discounts) can't be checked out.
    minimumOrder: store.minimumOrder || 0,
  };

  return res.status(200).json({ data: result });
});

const updateSettings = asyncHandler(async (req, res) => {
  validateSettingsPayload(req.body);
  const storeId = resolveTargetStoreId(req);

  const { storeName, description, logoUrl, contactEmail, contactPhone, minimumOrder, ...otherSettings } = req.body;

  // 1. Update the Store document for root fields
  const storeUpdates = {};
  if (storeName !== undefined) storeUpdates.name = storeName;
  if (description !== undefined) storeUpdates.description = description;
  // Multipart forms send numbers as strings
  if (minimumOrder !== undefined) storeUpdates.minimumOrder = Number(minimumOrder);
  if (contactEmail !== undefined || contactPhone !== undefined) {
    const store = await Store.findById(storeId).select("contact");
    storeUpdates.contact = {
      email: contactEmail !== undefined ? contactEmail : store.contact?.email,
      phone: contactPhone !== undefined ? contactPhone : store.contact?.phone,
    };
  }

  if (Object.keys(storeUpdates).length > 0) {
    await Store.findByIdAndUpdate(storeId, { $set: storeUpdates });
  }

  // 2. Update the StoreSettings document
  const settingsUpdates = { ...otherSettings };
  if (logoUrl !== undefined) settingsUpdates["branding.logoUrl"] = logoUrl;
  if (storeName !== undefined) settingsUpdates["branding.displayName"] = storeName;
  if (req.files && req.files.bannerImage && req.files.bannerImage[0].location) {
    const oldSettings = await StoreSettings.findOne({ store: storeId });
    if (oldSettings?.branding?.bannerUrl) {
      await deleteFileFromS3(oldSettings.branding.bannerUrl);
    }
    settingsUpdates["branding.bannerUrl"] = req.files.bannerImage[0].location;
    settingsUpdates["branding.bannerUploadedAt"] = new Date();
  }

  if (req.files && req.files.logoImage && req.files.logoImage[0].location) {
    const oldSettings = await StoreSettings.findOne({ store: storeId });
    if (oldSettings?.branding?.logoUrl) {
      await deleteFileFromS3(oldSettings.branding.logoUrl);
    }
    settingsUpdates["branding.logoUrl"] = req.files.logoImage[0].location;
  }

  const updatedSettings = await StoreSettings.findOneAndUpdate(
    { store: storeId },
    { $set: settingsUpdates },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({
    message: "Store settings updated",
    data: updatedSettings,
  });
});

/** GET /vendor/dashboard/fulfilment — delivery, collection and slot settings */
const getFulfilment = asyncHandler(async (req, res) => {
  const storeId = resolveTargetStoreId(req);
  const store = await Store.findById(storeId).select("fulfilment operatingHours timezone");
  if (!store) throw new ApiError(404, "Store not found");
  const hasHours = store.operatingHours instanceof Map ? store.operatingHours.size > 0 : false;
  res.status(200).json({ data: { ...fulfilmentOf(store), timezone: store.timezone || "UTC", hasHours } });
});

/** PATCH /vendor/dashboard/fulfilment */
const updateFulfilment = asyncHandler(async (req, res) => {
  validateFulfilmentSettings(req.body);
  const storeId = resolveTargetStoreId(req);
  const store = await Store.findById(storeId).select("fulfilment operatingHours timezone");
  if (!store) throw new ApiError(404, "Store not found");

  const next = { ...fulfilmentOf(store) };
  for (const key of Object.keys(DEFAULT_FULFILMENT).concat("collectionInstructions")) {
    if (req.body[key] !== undefined) next[key] = req.body[key];
  }
  if (!next.deliveryEnabled && !next.collectionEnabled) {
    throw new ApiError(400, "Offer at least one of delivery or collection");
  }
  store.fulfilment = next;
  await store.save();
  res.status(200).json({ message: "Fulfilment settings saved", data: fulfilmentOf(store) });
});

module.exports = {
  getSettings,
  updateSettings,
  getFulfilment,
  updateFulfilment,
};
