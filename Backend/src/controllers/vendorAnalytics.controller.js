const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const {
  computeDelta,
  computePreviousPeriod,
  granularityToFormat,
  resolveDateRange,
  validateGranularity,
} = require("../lib/analyticsUtils");
const Order = require("../models/Order");
const Product = require("../models/Product");

const aggregatePeriod = async (storeFilter, dateRange) => {
  const baseFilter = {
    ...storeFilter,
    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
  };
  const paidFilter = { ...baseFilter, paymentStatus: "paid" };

  const [totalOrders, paidAgg, uniqueCustomers] = await Promise.all([
    Order.countDocuments(baseFilter),
    Order.aggregate([
      { $match: paidFilter },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          commission: { $sum: "$commission.amount" },
          paidOrders: { $sum: 1 },
          itemsSold: { $sum: { $sum: "$items.quantity" } },
        },
      },
    ]),
    Order.distinct("customer", paidFilter).then((arr) => arr.length),
  ]);

  const paid = paidAgg[0] || {
    revenue: 0,
    commission: 0,
    paidOrders: 0,
    itemsSold: 0,
  };

  const aov = paid.paidOrders > 0 ? paid.revenue / paid.paidOrders : 0;

  return {
    totalOrders,
    paidOrders: paid.paidOrders,
    revenue: Number((paid.revenue || 0).toFixed(2)),
    commission: Number((paid.commission || 0).toFixed(2)),
    netPayout: Number(((paid.revenue || 0) - (paid.commission || 0)).toFixed(2)),
    averageOrderValue: Number(aov.toFixed(2)),
    itemsSold: paid.itemsSold || 0,
    uniqueCustomers,
  };
};

const overview = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const compareToPrevious = req.query.compareToPrevious === "true";

  const current = await aggregatePeriod(req.storeScopeFilter, range);

  let comparison = null;
  if (compareToPrevious) {
    const previousRange = computePreviousPeriod(range.startDate, range.endDate);
    const previous = await aggregatePeriod(
      req.storeScopeFilter,
      previousRange
    );
    comparison = {
      previousRange,
      previous,
      delta: {
        revenue: computeDelta(current.revenue, previous.revenue),
        netPayout: computeDelta(current.netPayout, previous.netPayout),
        paidOrders: computeDelta(current.paidOrders, previous.paidOrders),
        totalOrders: computeDelta(current.totalOrders, previous.totalOrders),
        averageOrderValue: computeDelta(
          current.averageOrderValue,
          previous.averageOrderValue
        ),
        uniqueCustomers: computeDelta(
          current.uniqueCustomers,
          previous.uniqueCustomers
        ),
        itemsSold: computeDelta(current.itemsSold, previous.itemsSold),
      },
    };
  }

  res.status(200).json({
    data: {
      range,
      current,
      comparison,
    },
  });
});

const salesTrend = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const granularity = validateGranularity(req.query.granularity);
  const format = granularityToFormat(granularity);

  const series = await Order.aggregate([
    {
      $match: {
        ...req.storeScopeFilter,
        paymentStatus: "paid",
        createdAt: { $gte: range.startDate, $lte: range.endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format, date: "$createdAt" } },
        revenue: { $sum: "$total" },
        commission: { $sum: "$commission.amount" },
        orders: { $sum: 1 },
        items: { $sum: { $sum: "$items.quantity" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    data: {
      range,
      granularity,
      series: series.map((point) => ({
        bucket: point._id,
        revenue: Number((point.revenue || 0).toFixed(2)),
        commission: Number((point.commission || 0).toFixed(2)),
        netPayout: Number(
          ((point.revenue || 0) - (point.commission || 0)).toFixed(2)
        ),
        orders: point.orders,
        items: point.items,
      })),
    },
  });
});

const topProducts = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const sortBy = ["quantity", "revenue"].includes(req.query.sortBy)
    ? req.query.sortBy
    : "revenue";
  const sortKey = sortBy === "quantity" ? "quantitySold" : "revenue";

  const top = await Order.aggregate([
    {
      $match: {
        ...req.storeScopeFilter,
        paymentStatus: "paid",
        createdAt: { $gte: range.startDate, $lte: range.endDate },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        snapshotTitle: { $first: "$items.title" },
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.total" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { [sortKey]: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  ]);

  res.status(200).json({
    data: {
      range,
      sortBy,
      products: top.map((entry) => ({
        productId: entry._id,
        title: entry.product?.title || entry.snapshotTitle || "",
        image: entry.product?.images?.[0] || "",
        currentPrice: entry.product?.price ?? null,
        isActive: entry.product?.isActive ?? null,
        quantitySold: entry.quantitySold,
        revenue: Number(entry.revenue.toFixed(2)),
        orderCount: entry.orderCount,
      })),
    },
  });
});

const orderBreakdown = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const filter = {
    ...req.storeScopeFilter,
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };

  const [byStatus, byPaymentStatus, byPaymentMethod] = await Promise.all([
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]),
  ]);

  res.status(200).json({
    data: {
      range,
      byOrderStatus: byStatus.map((b) => ({
        status: b._id,
        count: b.count,
        total: Number((b.total || 0).toFixed(2)),
      })),
      byPaymentStatus: byPaymentStatus.map((b) => ({
        status: b._id,
        count: b.count,
        total: Number((b.total || 0).toFixed(2)),
      })),
      byPaymentMethod: byPaymentMethod.map((b) => ({
        method: b._id,
        count: b.count,
        total: Number((b.total || 0).toFixed(2)),
      })),
    },
  });
});

const customerInsights = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const periodFilter = {
    ...req.storeScopeFilter,
    paymentStatus: "paid",
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };
  const beforeFilter = {
    ...req.storeScopeFilter,
    paymentStatus: "paid",
    createdAt: { $lt: range.startDate },
  };

  const [customersInPeriod, customersBefore, topCustomers] = await Promise.all([
    Order.distinct("customer", periodFilter),
    Order.distinct("customer", beforeFilter),
    Order.aggregate([
      { $match: periodFilter },
      {
        $group: {
          _id: "$customer",
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
          name: { $first: "$customerSnapshot.name" },
          email: { $first: "$customerSnapshot.email" },
          firstOrder: { $min: "$createdAt" },
          lastOrder: { $max: "$createdAt" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const beforeSet = new Set(customersBefore.map(String));
  const newCustomers = customersInPeriod.filter(
    (id) => !beforeSet.has(String(id))
  ).length;
  const total = customersInPeriod.length;
  const returningCustomers = total - newCustomers;

  res.status(200).json({
    data: {
      range,
      total,
      newCustomers,
      returningCustomers,
      newCustomerRate:
        total > 0 ? Number(((newCustomers / total) * 100).toFixed(2)) : 0,
      topCustomers: topCustomers.map((c) => ({
        customerId: c._id,
        name: c.name || "",
        email: c.email || "",
        orderCount: c.orderCount,
        revenue: Number((c.revenue || 0).toFixed(2)),
        firstOrder: c.firstOrder,
        lastOrder: c.lastOrder,
      })),
    },
  });
});

const categoryBreakdown = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);

  const breakdown = await Order.aggregate([
    {
      $match: {
        ...req.storeScopeFilter,
        paymentStatus: "paid",
        createdAt: { $gte: range.startDate, $lte: range.endDate },
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$category._id",
        categoryName: { $first: "$category.name" },
        revenue: { $sum: "$items.total" },
        quantitySold: { $sum: "$items.quantity" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  res.status(200).json({
    data: {
      range,
      categories: breakdown.map((b) => ({
        categoryId: b._id || null,
        categoryName: b.categoryName || "Uncategorized",
        revenue: Number((b.revenue || 0).toFixed(2)),
        quantitySold: b.quantitySold,
        orderCount: b.orderCount,
      })),
    },
  });
});

const productPerformance = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
    throw new ApiError(400, "Invalid product id");
  }

  const product = await Product.findOne({
    _id: req.params.productId,
    ...req.storeScopeFilter,
  }).populate("category", "name slug");

  if (!product) {
    throw new ApiError(404, "Product not found in scope");
  }

  const range = resolveDateRange(req, 90);

  const [totalsAgg, dailyTrend] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          ...req.storeScopeFilter,
          paymentStatus: "paid",
          createdAt: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.product": product._id } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.total" },
          quantitySold: { $sum: "$items.quantity" },
          orderCount: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          ...req.storeScopeFilter,
          paymentStatus: "paid",
          createdAt: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.product": product._id } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$items.total" },
          quantitySold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totals = totalsAgg[0] || {
    revenue: 0,
    quantitySold: 0,
    orderCount: 0,
  };

  res.status(200).json({
    data: {
      product: {
        id: product._id,
        title: product.title,
        category: product.category
          ? { id: product.category._id, name: product.category.name }
          : null,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stock: product.stock,
        totalStock: product.totalStock,
        hasVariants: product.hasVariants,
        isActive: product.isActive,
      },
      range,
      sales: {
        revenue: Number((totals.revenue || 0).toFixed(2)),
        quantitySold: totals.quantitySold,
        orderCount: totals.orderCount,
      },
      dailyTrend: dailyTrend.map((d) => ({
        date: d._id,
        revenue: Number((d.revenue || 0).toFixed(2)),
        quantitySold: d.quantitySold,
      })),
    },
  });
});

module.exports = {
  overview,
  salesTrend,
  topProducts,
  orderBreakdown,
  customerInsights,
  categoryBreakdown,
  productPerformance,
};
