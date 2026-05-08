const asyncHandler = require("../lib/asyncHandler");
const { resolveTargetStoreId } = require("../middleware/storeScope.middleware");
const StoreSettings = require("../models/StoreSettings");
const { validateSettingsPayload } = require("../validators/store.validator");

const getSettings = asyncHandler(async (req, res) => {
  const storeId = resolveTargetStoreId(req);

  const settings = await StoreSettings.findOne({ store: storeId });
  if (!settings) {
    return res.status(200).json({
      data: {
        store: storeId,
        branding: { displayName: "", logoUrl: "", themeColor: "" },
        businessHours: "",
        policies: { returnPolicy: "", shippingPolicy: "" },
        notifications: { emailEnabled: true, smsEnabled: false, whatsappEnabled: false },
      },
    });
  }

  return res.status(200).json({ data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  validateSettingsPayload(req.body);
  const storeId = resolveTargetStoreId(req);

  const updated = await StoreSettings.findOneAndUpdate(
    { store: storeId },
    { $set: req.body },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({
    message: "Store settings updated",
    data: updated,
  });
});

module.exports = {
  getSettings,
  updateSettings,
};
