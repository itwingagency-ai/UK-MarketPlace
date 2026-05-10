const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Store = require("../models/Store");
const StoreSettings = require("../models/StoreSettings");
const User = require("../models/User");
const {
  ALLOWED_STORE_STATUSES,
  validateAdminStoreUpdate,
} = require("../validators/admin.validator");

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listStores = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) {
    if (!ALLOWED_STORE_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.status = req.query.status;
  }
  if (req.query.search) {
    const re = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ name: re }, { slug: re }];
  }

  const [stores, total] = await Promise.all([
    Store.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "name email status"),
    Store.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: stores });
});

const getStoreById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid store id");
  }
  const store = await Store.findById(req.params.id).populate(
    "owner",
    "name email status"
  );
  if (!store) throw new ApiError(404, "Store not found");

  const [productCount, orderCount, paidRevenueAgg, settings] = await Promise.all([
    Product.countDocuments({ store: store._id }),
    Order.countDocuments({ store: store._id }),
    Order.aggregate([
      { $match: { store: store._id, paymentStatus: "paid" } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          commission: { $sum: "$commission.amount" },
          orders: { $sum: 1 },
        },
      },
    ]),
    StoreSettings.findOne({ store: store._id }),
  ]);

  const revenue = paidRevenueAgg[0] || {
    revenue: 0,
    commission: 0,
    orders: 0,
  };

  res.status(200).json({
    data: {
      store,
      stats: {
        productCount,
        orderCount,
        paidOrders: revenue.orders,
        revenue: revenue.revenue,
        commission: revenue.commission,
      },
      settings: settings || null,
    },
  });
});

const updateStore = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid store id");
  }
  validateAdminStoreUpdate(req.body);

  const store = await Store.findById(req.params.id);
  if (!store) throw new ApiError(404, "Store not found");

  if (req.body.name !== undefined) store.name = req.body.name.trim();
  if (req.body.status !== undefined) store.status = req.body.status;
  if (req.body.commissionRate !== undefined) {
    store.commissionRate =
      req.body.commissionRate === null
        ? null
        : Number(req.body.commissionRate);
  }

  if (req.body.contact && typeof req.body.contact === "object") {
    if (req.body.contact.phone !== undefined) {
      store.contact.phone = req.body.contact.phone || "";
    }
    if (req.body.contact.email !== undefined) {
      store.contact.email = (req.body.contact.email || "").toLowerCase().trim();
    }
  }

  if (req.body.address && typeof req.body.address === "object") {
    const fields = [
      "line1",
      "line2",
      "city",
      "state",
      "postalCode",
      "country",
    ];
    for (const field of fields) {
      if (req.body.address[field] !== undefined) {
        store.address[field] = req.body.address[field] || "";
      }
    }
  }

  await store.save();
  res.status(200).json({ message: "Store updated", data: store });
});

const suspendStore = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid store id");
  }
  const store = await Store.findById(req.params.id);
  if (!store) throw new ApiError(404, "Store not found");
  if (store.status === "suspended") {
    return res
      .status(200)
      .json({ message: "Store already suspended", data: store });
  }
  store.status = "suspended";
  await store.save();
  res.status(200).json({ message: "Store suspended", data: store });
});

const reactivateStore = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid store id");
  }
  const store = await Store.findById(req.params.id);
  if (!store) throw new ApiError(404, "Store not found");
  if (store.status === "active") {
    return res
      .status(200)
      .json({ message: "Store already active", data: store });
  }

  const owner = await User.findById(store.owner);
  if (owner && owner.status !== "active") {
    throw new ApiError(
      409,
      "Cannot reactivate store while its owner account is suspended"
    );
  }

  store.status = "active";
  await store.save();
  res.status(200).json({ message: "Store reactivated", data: store });
});

module.exports = {
  listStores,
  getStoreById,
  updateStore,
  suspendStore,
  reactivateStore,
};
