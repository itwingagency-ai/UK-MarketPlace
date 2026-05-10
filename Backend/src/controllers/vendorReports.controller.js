const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const { buildCsv, resolveDateRange } = require("../lib/analyticsUtils");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { ALLOWED_STATUSES } = require("../validators/order.validator");

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const PAYMENT_METHODS = ["cod", "online"];

const sanitizeFilenameDate = (date) =>
  date.toISOString().slice(0, 10);

const buildOrderFilter = async (req, range) => {
  const filter = {
    ...req.storeScopeFilter,
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  };

  if (req.query.status) {
    if (!ALLOWED_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.orderStatus = req.query.status;
  }

  if (req.query.paymentStatus) {
    if (!PAYMENT_STATUSES.includes(req.query.paymentStatus)) {
      throw new ApiError(400, "Invalid paymentStatus filter");
    }
    filter.paymentStatus = req.query.paymentStatus;
  }

  if (req.query.paymentMethod) {
    if (!PAYMENT_METHODS.includes(req.query.paymentMethod)) {
      throw new ApiError(400, "Invalid paymentMethod filter");
    }
    filter.paymentMethod = req.query.paymentMethod;
  }

  if (req.query.category) {
    if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
      throw new ApiError(400, "Invalid category filter");
    }
    const productsInCategory = await Product.find({
      category: req.query.category,
      ...req.storeScopeFilter,
    }).select("_id");
    if (productsInCategory.length === 0) {
      // No products in this category for this store → impossible filter → empty
      filter._id = { $in: [] };
    } else {
      filter["items.product"] = {
        $in: productsInCategory.map((p) => p._id),
      };
    }
  }

  return filter;
};

const salesReport = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const filter = await buildOrderFilter(req, range);

  const format = (req.query.format || "json").toLowerCase();

  if (format === "csv") {
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    const headers = [
      "orderNumber",
      "createdAt",
      "customerName",
      "customerEmail",
      "items",
      "subtotal",
      "shippingFee",
      "total",
      "paymentMethod",
      "paymentStatus",
      "orderStatus",
      "commissionAmount",
      "netPayout",
    ];

    const rows = orders.map((o) => {
      const itemsSummary = (o.items || [])
        .map((i) => `${i.title} x${i.quantity}`)
        .join("; ");
      const commission = Number(o.commission?.amount || 0);
      const netPayout = Number((Number(o.total) - commission).toFixed(2));
      return [
        o.orderNumber,
        o.createdAt ? new Date(o.createdAt).toISOString() : "",
        o.customerSnapshot?.name || "",
        o.customerSnapshot?.email || "",
        itemsSummary,
        o.subtotal,
        o.shippingFee,
        o.total,
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
        commission,
        netPayout,
      ];
    });

    const csv = buildCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales-report-${sanitizeFilenameDate(
        range.startDate
      )}-to-${sanitizeFilenameDate(range.endDate)}.csv"`
    );
    return res.send(csv);
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const skip = (page - 1) * limit;

  const [orders, total, summaryAgg] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "orderNumber customerSnapshot subtotal shippingFee total paymentMethod paymentStatus orderStatus commission tracking createdAt"
      ),
    Order.countDocuments(filter),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          paidRevenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0],
            },
          },
          totalCommission: { $sum: "$commission.amount" },
          orderCount: { $sum: 1 },
          paidOrders: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const summary = summaryAgg[0] || {
    totalRevenue: 0,
    paidRevenue: 0,
    totalCommission: 0,
    orderCount: 0,
    paidOrders: 0,
  };

  return res.status(200).json({
    page,
    limit,
    total,
    range,
    filters: {
      status: req.query.status || null,
      paymentStatus: req.query.paymentStatus || null,
      paymentMethod: req.query.paymentMethod || null,
      category: req.query.category || null,
    },
    summary: {
      totalOrders: summary.orderCount,
      paidOrders: summary.paidOrders,
      totalRevenue: Number((summary.totalRevenue || 0).toFixed(2)),
      paidRevenue: Number((summary.paidRevenue || 0).toFixed(2)),
      totalCommission: Number((summary.totalCommission || 0).toFixed(2)),
      netPayout: Number(
        (
          (summary.paidRevenue || 0) - (summary.totalCommission || 0)
        ).toFixed(2)
      ),
    },
    data: orders,
  });
});

const productPerformanceReport = asyncHandler(async (req, res) => {
  const range = resolveDateRange(req, 30);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const format = (req.query.format || "json").toLowerCase();

  const aggregated = await Order.aggregate([
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
    { $sort: { revenue: -1 } },
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
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  ]);

  if (format === "csv") {
    const headers = [
      "productId",
      "title",
      "categoryName",
      "currentPrice",
      "currentStock",
      "isActive",
      "quantitySold",
      "revenue",
      "orderCount",
    ];
    const rows = aggregated.map((p) => [
      p._id,
      p.product?.title || p.snapshotTitle || "",
      p.category?.name || "",
      p.product?.price ?? "",
      p.product?.stock ?? "",
      p.product?.isActive ?? "",
      p.quantitySold,
      Number(p.revenue.toFixed(2)),
      p.orderCount,
    ]);
    const csv = buildCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="product-performance-${sanitizeFilenameDate(
        range.startDate
      )}-to-${sanitizeFilenameDate(range.endDate)}.csv"`
    );
    return res.send(csv);
  }

  return res.status(200).json({
    data: {
      range,
      products: aggregated.map((p) => ({
        productId: p._id,
        title: p.product?.title || p.snapshotTitle || "",
        category: p.category
          ? { id: p.category._id, name: p.category.name }
          : null,
        currentPrice: p.product?.price ?? null,
        currentStock: p.product?.stock ?? null,
        isActive: p.product?.isActive ?? null,
        quantitySold: p.quantitySold,
        revenue: Number(p.revenue.toFixed(2)),
        orderCount: p.orderCount,
      })),
    },
  });
});

module.exports = {
  salesReport,
  productPerformanceReport,
};
