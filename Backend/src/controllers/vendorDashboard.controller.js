const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");

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

  const reviewAgg = await Review.aggregate([
    { $match: { ...scopeFilter } },
    { $group: { _id: null, averageRating: { $avg: "$rating" } } }
  ]);

  const recentOrders = await Order.find({ ...scopeFilter })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("orderNumber total orderStatus paymentStatus createdAt");

  const today = new Date();
  const past7Days = new Date(today);
  past7Days.setDate(today.getDate() - 6);
  past7Days.setHours(0, 0, 0, 0);

  const trendAgg = await Order.aggregate([
    {
      $match: {
        ...scopeFilter,
        paymentStatus: "paid",
        createdAt: { $gte: past7Days }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$total" }
      }
    }
  ]);

  const trendMap = {};
  trendAgg.forEach(t => {
    trendMap[t._id] = t.revenue;
  });

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const revenueTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    revenueTrend.push({
      date: days[d.getDay()],
      revenue: trendMap[dateStr] || 0
    });
  }

  res.status(200).json({
    metrics: {
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
      averageRating: reviewAgg[0]?.averageRating || 0,
    },
    revenueTrend,
    recentOrders
  });
});

module.exports = { getOverview };
