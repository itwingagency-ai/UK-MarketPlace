const asyncHandler = require("../lib/asyncHandler");
const ApiError = require("../lib/ApiError");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const Store = require("../models/Store");
const StoreSettings = require("../models/StoreSettings");
const { validateSettingsPayload } = require("../validators/store.validator");

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
    contactEmail: store.contact?.email || "",
    contactPhone: store.contact?.phone || "",
    // Retain other nested settings objects so frontend doesn't break if accessed elsewhere
    branding: settings?.branding || { displayName: store.name, logoUrl: "", themeColor: "" },
    businessHours: settings?.businessHours || "",
    policies: settings?.policies || { returnPolicy: "", shippingPolicy: "" },
    notifications: settings?.notifications || { emailEnabled: true, smsEnabled: false, whatsappEnabled: false },
    shipping: settings?.shipping || { flatFee: 0, freeShippingThreshold: 0 },
  };

  return res.status(200).json({ data: result });
});

const updateSettings = asyncHandler(async (req, res) => {
  validateSettingsPayload(req.body);
  const storeId = resolveTargetStoreId(req);

  const { storeName, description, logoUrl, contactEmail, contactPhone, ...otherSettings } = req.body;

  // 1. Update the Store document for root fields
  const storeUpdates = {};
  if (storeName !== undefined) storeUpdates.name = storeName;
  if (description !== undefined) storeUpdates.description = description;
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

module.exports = {
  getSettings,
  updateSettings,
};
