const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const Product = require("../models/Product");

const getOverview = asyncHandler(async (req, res) => {
  const scopeFilter = req.storeScopeFilter || {};

  const [totalProducts, activeProducts, totalOrders, pendingOrders, completedOrders] =
    await Promise.all([
      Product.countDocuments({ ...scopeFilter }),
      Product.countDocuments({ ...scopeFilter, isActive: true }),
      Order.countDocuments({ ...scopeFilter }),
      Order.countDocuments({ ...scopeFilter, orderStatus: "pending" }),
      Order.countDocuments({ ...scopeFilter, orderStatus: "delivered" }),
    ]);

  const revenueAgg = await Order.aggregate([
    { $match: { ...scopeFilter, paymentStatus: "paid" } },
    { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
  ]);

  const recentOrders = await Order.find({ ...scopeFilter })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("total orderStatus paymentStatus createdAt");

  res.status(200).json({
    metrics: {
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
    },
    recentOrders,
  });
});

module.exports = { getOverview };
