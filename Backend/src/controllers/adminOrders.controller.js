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

const listAllOrders = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.storeId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.storeId)) {
      throw new ApiError(400, "Invalid storeId filter");
    }
    filter.store = req.query.storeId;
  }

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
    const re = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [
      { orderNumber: re },
      { "customerSnapshot.email": re },
      { "customerSnapshot.name": re },
    ];
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
      .populate("customer", "name email")
      .select(
        "orderNumber store customer customerSnapshot subtotal shippingFee total paymentMethod paymentStatus orderStatus tracking commission createdAt"
      ),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: orders });
});

const getOrderById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(req.params.id)
    .populate("store", "name slug owner status")
    .populate("customer", "name email phone")
    .populate("items.product", "title images")
    .populate("statusHistory.changedBy", "name email role");

  if (!order) throw new ApiError(404, "Order not found");
  res.status(200).json({ data: order });
});

module.exports = {
  listAllOrders,
  getOrderById,
};
