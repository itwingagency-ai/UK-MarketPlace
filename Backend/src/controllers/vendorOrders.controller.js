const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const { validateOrderStatusUpdate } = require("../validators/order.validator");

const listOrders = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { ...req.storeScopeFilter };
  if (req.query.status) {
    filter.orderStatus = req.query.status;
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("customer subtotal shippingFee total paymentMethod paymentStatus orderStatus createdAt");
  const total = await Order.countDocuments(filter);

  res.status(200).json({
    page,
    limit,
    total,
    data: orders,
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

  res.status(200).json({ data: order });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

  const nextStatus = req.body.orderStatus;
  if (!nextStatus) {
    throw new ApiError(400, "orderStatus is required");
  }

  validateOrderStatusUpdate(order.orderStatus, nextStatus);

  order.orderStatus = nextStatus;
  await order.save();

  res.status(200).json({
    message: "Order status updated",
    data: order,
  });
});

module.exports = {
  listOrders,
  getOrderById,
  updateOrderStatus,
};
