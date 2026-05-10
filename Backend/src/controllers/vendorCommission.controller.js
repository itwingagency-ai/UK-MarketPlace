const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const {
  buildCommissionSnapshot,
  resolveCommissionConfig,
} = require("../lib/commissionUtils");
const Order = require("../models/Order");
const PlatformSettings = require("../models/PlatformSettings");
const Store = require("../models/Store");

const parseDate = (value, label) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${label} must be a valid ISO date`);
  }
  return d;
};

const buildDateFilter = (req) => {
  const startDate = parseDate(req.query.startDate, "startDate");
  const endDate = parseDate(req.query.endDate, "endDate");
  if (!startDate && !endDate) return null;
  const range = {};
  if (startDate) range.$gte = startDate;
  if (endDate) range.$lte = endDate;
  return range;
};

const getCommissionSummary = asyncHandler(async (req, res) => {
  const storeId = req.storeScopeId;
  if (!storeId) {
    throw new ApiError(403, "No store scope resolved for this request");
  }

  const filter = { paymentStatus: "paid", store: storeId };
  const dateFilter = buildDateFilter(req);
  if (dateFilter) filter.createdAt = dateFilter;

  const [agg, dailyAgg, store, platform] = await Promise.all([
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
    Order.aggregate([
      { $match: filter },
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
    ]),
    Store.findById(storeId).select(
      "name slug status commissionType commissionRate commissionFixed"
    ),
    PlatformSettings.getOrInit(),
  ]);

  const totals = agg[0] || { revenue: 0, commission: 0, orders: 0 };
  const config = resolveCommissionConfig(store, platform);

  res.status(200).json({
    data: {
      store: store
        ? {
            id: store._id,
            name: store.name,
            slug: store.slug,
            status: store.status,
          }
        : null,
      effectiveConfig: config,
      override: store
        ? {
            commissionType: store.commissionType,
            commissionRate: store.commissionRate,
            commissionFixed: store.commissionFixed,
          }
        : null,
      totals: {
        revenue: totals.revenue,
        commission: totals.commission,
        netPayout: totals.revenue - totals.commission,
        orders: totals.orders,
      },
      dailySeries: dailyAgg.map((point) => ({
        date: point._id,
        revenue: point.revenue,
        commission: point.commission,
        netPayout: point.revenue - point.commission,
        orders: point.orders,
      })),
    },
  });
});

const getCommissionLedger = asyncHandler(async (req, res) => {
  const storeId = req.storeScopeId;
  if (!storeId) {
    throw new ApiError(403, "No store scope resolved for this request");
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { paymentStatus: "paid", store: storeId };
  const dateFilter = buildDateFilter(req);
  if (dateFilter) filter.createdAt = dateFilter;

  const [orders, total, totalsAgg] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "orderNumber total subtotal shippingFee paymentMethod paymentStatus orderStatus commission createdAt customerSnapshot"
      ),
    Order.countDocuments(filter),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          commission: { $sum: "$commission.amount" },
        },
      },
    ]),
  ]);

  const totals = totalsAgg[0] || { revenue: 0, commission: 0 };

  res.status(200).json({
    page,
    limit,
    total,
    totals: {
      revenue: totals.revenue,
      commission: totals.commission,
      netPayout: totals.revenue - totals.commission,
    },
    data: orders.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      placedAt: o.createdAt,
      customerEmail: o.customerSnapshot?.email || "",
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      subtotal: o.subtotal,
      shippingFee: o.shippingFee,
      total: o.total,
      commission: {
        type: o.commission?.type || null,
        rate: o.commission?.rate ?? 0,
        fixed: o.commission?.fixed ?? 0,
        amount: o.commission?.amount ?? 0,
        sourceRate: o.commission?.sourceRate || null,
        calculatedAt: o.commission?.calculatedAt || null,
      },
      netPayout: Number(o.total) - Number(o.commission?.amount || 0),
    })),
  });
});

const previewCommission = asyncHandler(async (req, res) => {
  const storeId = req.storeScopeId;
  if (!storeId) {
    throw new ApiError(403, "No store scope resolved for this request");
  }

  const orderTotal = Number(req.query.orderTotal);
  if (Number.isNaN(orderTotal) || orderTotal < 0) {
    throw new ApiError(
      400,
      "orderTotal query parameter is required and must be non-negative"
    );
  }

  const [store, platform] = await Promise.all([
    Store.findById(storeId).select(
      "commissionType commissionRate commissionFixed"
    ),
    PlatformSettings.getOrInit(),
  ]);

  const config = resolveCommissionConfig(store, platform);
  const snapshot = buildCommissionSnapshot(config, orderTotal);

  res.status(200).json({
    data: {
      orderTotal,
      effectiveConfig: config,
      commission: snapshot,
      netPayout: orderTotal - snapshot.amount,
    },
  });
});

module.exports = {
  getCommissionSummary,
  getCommissionLedger,
  previewCommission,
};
