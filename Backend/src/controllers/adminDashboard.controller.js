const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Store = require("../models/Store");
const User = require("../models/User");
const VendorApplication = require("../models/VendorApplication");

const parseInteger = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
};

const overview = asyncHandler(async (req, res) => {
  const [
    totalAdmins,
    totalVendors,
    totalCustomers,
    totalStores,
    activeStores,
    suspendedStores,
    totalProducts,
    activeProducts,
    totalOrders,
    pendingOrders,
    deliveredOrders,
    cancelledOrders,
    pendingApplications,
  ] = await Promise.all([
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ role: "vendor" }),
    User.countDocuments({ role: "customer" }),
    Store.countDocuments(),
    Store.countDocuments({ status: "active" }),
    Store.countDocuments({ status: "suspended" }),
    Product.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: "pending" }),
    Order.countDocuments({ orderStatus: "delivered" }),
    Order.countDocuments({ orderStatus: "cancelled" }),
    VendorApplication.countDocuments({ status: "pending" }),
  ]);

  const revenueAgg = await Order.aggregate([
    { $match: { paymentStatus: "paid" } },
    {
      $group: {
        _id: null,
        gross: { $sum: "$total" },
        commission: { $sum: "$commission.amount" },
        orderCount: { $sum: 1 },
      },
    },
  ]);
  const revenue = revenueAgg[0] || { gross: 0, commission: 0, orderCount: 0 };

  res.status(200).json({
    data: {
      users: {
        admins: totalAdmins,
        vendors: totalVendors,
        customers: totalCustomers,
        total: totalAdmins + totalVendors + totalCustomers,
      },
      stores: {
        total: totalStores,
        active: activeStores,
        suspended: suspendedStores,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      revenue: {
        gross: revenue.gross,
        commission: revenue.commission,
        netToVendors: revenue.gross - revenue.commission,
        paidOrderCount: revenue.orderCount,
      },
      vendorApplications: {
        pending: pendingApplications,
      },
    },
  });
});

const recentActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInteger(req.query.limit, 10), 1), 50);

  const [recentOrders, pendingApplications, recentStores, recentUsers] =
    await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(
          "orderNumber store customer total orderStatus paymentStatus createdAt"
        )
        .populate("store", "name slug")
        .populate("customer", "name email"),
      VendorApplication.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("applicant", "name email"),
      Store.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("owner", "name email")
        .select("name slug owner status createdAt"),
      User.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("name email role status createdAt"),
    ]);

  res.status(200).json({
    data: {
      recentOrders,
      pendingApplications,
      recentStores,
      recentUsers,
    },
  });
});

const salesAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInteger(req.query.days, 30), 1), 365);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);

  const series = await Order.aggregate([
    { $match: { paymentStatus: "paid", createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        revenue: { $sum: "$total" },
        commission: { $sum: "$commission.amount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    data: {
      since,
      days,
      series: series.map((point) => ({
        date: point._id,
        revenue: point.revenue,
        commission: point.commission,
        orders: point.orders,
      })),
    },
  });
});

const topStores = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInteger(req.query.limit, 5), 1), 50);

  const aggregated = await Order.aggregate([
    { $match: { paymentStatus: "paid" } },
    {
      $group: {
        _id: "$store",
        revenue: { $sum: "$total" },
        commission: { $sum: "$commission.amount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "stores",
        localField: "_id",
        foreignField: "_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
  ]);

  res.status(200).json({
    data: aggregated.map((entry) => ({
      storeId: entry._id,
      storeName: entry.store?.name || "",
      storeSlug: entry.store?.slug || "",
      revenue: entry.revenue,
      commission: entry.commission,
      orderCount: entry.orderCount,
    })),
  });
});

module.exports = {
  overview,
  recentActivity,
  salesAnalytics,
  topStores,
};
