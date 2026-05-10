const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const { ALLOWED_STATUSES } = require("../validators/order.validator");

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDate = (value, label) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${label} must be a valid ISO date`);
  }
  return d;
};

const listMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { customer: req.user.id };

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

  if (req.query.search) {
    filter.orderNumber = new RegExp(
      escapeRegex(req.query.search.trim()),
      "i"
    );
  }

  const startDate = parseDate(req.query.startDate, "startDate");
  const endDate = parseDate(req.query.endDate, "endDate");
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("store", "name slug")
      .select(
        "orderNumber store items subtotal shippingFee total paymentMethod paymentStatus orderStatus tracking createdAt"
      ),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    page,
    limit,
    total,
    data: orders,
  });
});

const getMyOrderById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findOne({
    _id: req.params.id,
    customer: req.user.id,
  })
    .populate("store", "name slug")
    .populate("items.product", "title images");

  if (!order) throw new ApiError(404, "Order not found");

  res.status(200).json({ data: order });
});

const getMyOrderHistory = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findOne({
    _id: req.params.id,
    customer: req.user.id,
  }).select(
    "orderNumber orderStatus paymentStatus tracking statusHistory shippingMethod"
  );

  if (!order) throw new ApiError(404, "Order not found");

  const tracking = order.tracking || {};
  res.status(200).json({
    data: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      shippingMethod: order.shippingMethod
        ? {
            name: order.shippingMethod.name || "",
            code: order.shippingMethod.code || "",
            minDays: order.shippingMethod.minDays || 0,
            maxDays: order.shippingMethod.maxDays || 0,
          }
        : null,
      tracking: {
        carrier: tracking.carrier || "",
        trackingNumber: tracking.trackingNumber || "",
        trackingUrl: tracking.trackingUrl || "",
        shippedAt: tracking.shippedAt || null,
        deliveredAt: tracking.deliveredAt || null,
        cancelledAt: tracking.cancelledAt || null,
        estimatedDeliveryEarliest: tracking.estimatedDeliveryEarliest || null,
        estimatedDeliveryLatest: tracking.estimatedDeliveryLatest || null,
        events: ((tracking.events || []).map((event) => ({
          status: event.status,
          at: event.at,
          location: event.location || "",
          note: event.note || "",
        }))),
      },
      statusHistory: (order.statusHistory || []).map((entry) => ({
        status: entry.status,
        changedAt: entry.changedAt,
        note: entry.note,
      })),
    },
  });
});

module.exports = {
  listMyOrders,
  getMyOrderById,
  getMyOrderHistory,
};
