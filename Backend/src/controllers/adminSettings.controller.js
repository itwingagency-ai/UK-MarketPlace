const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { resolveCommissionConfig } = require("../lib/commissionUtils");
const Order = require("../models/Order");
const PlatformSettings = require("../models/PlatformSettings");
const Store = require("../models/Store");
const {
  validatePlatformSettingsUpdate,
  validateStoreCommissionPayload,
} = require("../validators/admin.validator");

const getSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getOrInit();
  res.status(200).json({ data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  validatePlatformSettingsUpdate(req.body);

  const settings = await PlatformSettings.getOrInit();

  if (req.body.platformName !== undefined) {
    settings.platformName = req.body.platformName.trim();
  }
  if (req.body.supportEmail !== undefined) {
    settings.supportEmail = (req.body.supportEmail || "").toLowerCase().trim();
  }
  if (req.body.supportPhone !== undefined) {
    settings.supportPhone = (req.body.supportPhone || "").trim();
  }
  if (req.body.currency !== undefined) {
    settings.currency = req.body.currency.toLowerCase().trim();
  }

  if (req.body.commission && typeof req.body.commission === "object") {
    if (req.body.commission.type !== undefined) {
      settings.commission.type = req.body.commission.type;
    }
    if (req.body.commission.defaultRate !== undefined) {
      settings.commission.defaultRate = Number(req.body.commission.defaultRate);
    }
    if (req.body.commission.defaultFixed !== undefined) {
      settings.commission.defaultFixed = Number(
        req.body.commission.defaultFixed
      );
    }
  }

  if (req.body.policies && typeof req.body.policies === "object") {
    const fields = ["termsOfService", "privacyPolicy", "refundPolicy"];
    for (const field of fields) {
      if (req.body.policies[field] !== undefined) {
        settings.policies[field] = String(req.body.policies[field] || "").slice(
          0,
          10000
        );
      }
    }
  }

  if (req.body.features && typeof req.body.features === "object") {
    const fields = [
      "vendorSelfRegistration",
      "onlinePaymentEnabled",
      "codEnabled",
      "reviewsEnabled",
    ];
    for (const field of fields) {
      if (req.body.features[field] !== undefined) {
        settings.features[field] = Boolean(req.body.features[field]);
      }
    }
  }

  await settings.save();
  res.status(200).json({ message: "Platform settings updated", data: settings });
});

const commissionSummary = asyncHandler(async (req, res) => {
  const filter = { paymentStatus: "paid" };

  if (req.query.storeId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.storeId)) {
      throw new ApiError(400, "Invalid storeId filter");
    }
    filter.store = new mongoose.Types.ObjectId(req.query.storeId);
  }

  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) {
      const d = new Date(req.query.startDate);
      if (Number.isNaN(d.getTime())) {
        throw new ApiError(400, "Invalid startDate");
      }
      filter.createdAt.$gte = d;
    }
    if (req.query.endDate) {
      const d = new Date(req.query.endDate);
      if (Number.isNaN(d.getTime())) {
        throw new ApiError(400, "Invalid endDate");
      }
      filter.createdAt.$lte = d;
    }
  }

  const [byStore, totalAgg, settings] = await Promise.all([
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$store",
          revenue: { $sum: "$total" },
          commission: { $sum: "$commission.amount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { commission: -1 } },
      {
        $lookup: {
          from: "stores",
          localField: "_id",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    ]),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          commission: { $sum: "$commission.amount" },
          orders: { $sum: 1 },
        },
      },
    ]),
    PlatformSettings.getOrInit(),
  ]);

  const totals = totalAgg[0] || { revenue: 0, commission: 0, orders: 0 };

  res.status(200).json({
    data: {
      platform: {
        type: settings.commission.type,
        defaultRate: settings.commission.defaultRate,
        defaultFixed: settings.commission.defaultFixed,
      },
      totals: {
        revenue: totals.revenue,
        commission: totals.commission,
        netToVendors: totals.revenue - totals.commission,
        orders: totals.orders,
      },
      byStore: byStore.map((entry) => {
        const config = resolveCommissionConfig(entry.store, settings);
        return {
          storeId: entry._id,
          storeName: entry.store?.name || "",
          storeSlug: entry.store?.slug || "",
          storeStatus: entry.store?.status || "",
          override: {
            commissionType: entry.store?.commissionType ?? null,
            commissionRate: entry.store?.commissionRate ?? null,
            commissionFixed: entry.store?.commissionFixed ?? null,
          },
          effective: {
            source: config.source,
            type: config.type,
            rate: config.rate,
            fixed: config.fixed,
          },
          revenue: entry.revenue,
          commission: entry.commission,
          netToVendor: entry.revenue - entry.commission,
          orders: entry.orders,
        };
      }),
    },
  });
});

const setStoreCommission = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.storeId)) {
    throw new ApiError(400, "Invalid store id");
  }

  validateStoreCommissionPayload(req.body);

  const store = await Store.findById(req.params.storeId);
  if (!store) throw new ApiError(404, "Store not found");

  // Legacy form: { commissionRate: 0..1 | null }
  if (req.body.commissionRate !== undefined && req.body.type === undefined) {
    if (req.body.commissionRate === null) {
      store.commissionType = null;
      store.commissionRate = null;
      store.commissionFixed = null;
    } else {
      store.commissionType = "percentage";
      store.commissionRate = Number(req.body.commissionRate);
      store.commissionFixed = null;
    }
  }

  // New form: { type, rate?, fixed? }
  if (req.body.type !== undefined) {
    if (req.body.type === null) {
      store.commissionType = null;
      store.commissionRate = null;
      store.commissionFixed = null;
    } else if (req.body.type === "percentage") {
      store.commissionType = "percentage";
      store.commissionRate = Number(req.body.rate);
      store.commissionFixed = null;
    } else if (req.body.type === "fixed") {
      store.commissionType = "fixed";
      store.commissionFixed = Number(req.body.fixed);
      store.commissionRate = null;
    }
  }

  await store.save();

  const platform = await PlatformSettings.getOrInit();
  const effective = resolveCommissionConfig(store, platform);

  res.status(200).json({
    message: "Commission configuration updated",
    data: {
      storeId: store._id,
      override: {
        commissionType: store.commissionType,
        commissionRate: store.commissionRate,
        commissionFixed: store.commissionFixed,
      },
      effective,
    },
  });
});

module.exports = {
  getSettings,
  updateSettings,
  commissionSummary,
  setStoreCommission,
};
