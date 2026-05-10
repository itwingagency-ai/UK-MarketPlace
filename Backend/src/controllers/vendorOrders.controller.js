const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
<<<<<<< HEAD
const Order = require("../models/Order");
const { validateOrderStatusUpdate } = require("../validators/order.validator");
=======
const {
  appendPaymentEvent,
  applyCommissionSnapshot,
} = require("../lib/paymentService");
const { computeEstimatedDelivery } = require("../lib/shippingUtils");
const {
  onOrderCancelled,
  onOrderDelivered,
  onOrderPaymentSucceeded,
  onOrderShipped,
  onShipmentEvent,
} = require("../lib/notificationHooks");
const Order = require("../models/Order");
const {
  ALLOWED_STATUSES,
  validateOrderStatusPayload,
  validateShipmentEventPayload,
} = require("../validators/order.validator");

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const parseDate = (value, label) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${label} must be a valid ISO date`);
  }
  return d;
};

const buildListFilter = (req) => {
  const filter = { ...req.storeScopeFilter };

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
      { "customerSnapshot.name": re },
      { "customerSnapshot.email": re },
      { "customerSnapshot.phone": re },
    ];
  }

  const startDate = parseDate(req.query.startDate, "startDate");
  const endDate = parseDate(req.query.endDate, "endDate");
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  return filter;
};
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81

const listOrders = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

<<<<<<< HEAD
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
=======
  const filter = buildListFilter(req);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "orderNumber customer customerSnapshot subtotal shippingFee total paymentMethod paymentStatus orderStatus tracking createdAt"
      )
      .populate("customer", "name email"),
    Order.countDocuments(filter),
  ]);
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81

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

<<<<<<< HEAD
  res.status(200).json({ data: order });
});

=======
  await order.populate([
    { path: "customer", select: "name email" },
    { path: "items.product", select: "title images" },
    { path: "statusHistory.changedBy", select: "name email role" },
  ]);

  res.status(200).json({ data: order });
});

const getOrderHistory = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

  await order.populate({
    path: "statusHistory.changedBy",
    select: "name email role",
  });

  res.status(200).json({
    data: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      tracking: order.tracking,
      statusHistory: order.statusHistory,
    },
  });
});

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

<<<<<<< HEAD
  const nextStatus = req.body.orderStatus;
  if (!nextStatus) {
    throw new ApiError(400, "orderStatus is required");
  }

  validateOrderStatusUpdate(order.orderStatus, nextStatus);

  order.orderStatus = nextStatus;
  await order.save();

=======
  const { nextStatus } = validateOrderStatusPayload(req.body, order.orderStatus);

  order.orderStatus = nextStatus;

  if (req.body.tracking) {
    const fields = ["carrier", "trackingNumber", "trackingUrl", "cancellationReason"];
    for (const key of fields) {
      if (req.body.tracking[key] !== undefined) {
        order.tracking[key] =
          req.body.tracking[key] === null ? "" : req.body.tracking[key];
      }
    }
  }

  const now = new Date();
  if (nextStatus === "shipped" && !order.tracking.shippedAt) {
    order.tracking.shippedAt = now;

    if (
      order.shippingMethod &&
      (order.shippingMethod.minDays || order.shippingMethod.maxDays)
    ) {
      const eta = computeEstimatedDelivery(order.shippingMethod, now);
      if (eta.earliest && !order.tracking.estimatedDeliveryEarliest) {
        order.tracking.estimatedDeliveryEarliest = eta.earliest;
      }
      if (eta.latest && !order.tracking.estimatedDeliveryLatest) {
        order.tracking.estimatedDeliveryLatest = eta.latest;
      }
    }

    order.tracking.events.push({
      status: "created",
      at: now,
      location: "",
      note: order.tracking.carrier
        ? `Shipment created via ${order.tracking.carrier}`
        : "Shipment created",
      by: req.user.id,
      byRole: req.user.role,
    });
  }
  if (nextStatus === "delivered" && !order.tracking.deliveredAt) {
    order.tracking.deliveredAt = now;

    order.tracking.events.push({
      status: "delivered",
      at: now,
      location: "",
      note: "Order delivered to customer",
      by: req.user.id,
      byRole: req.user.role,
    });
  }
  if (nextStatus === "cancelled" && !order.tracking.cancelledAt) {
    order.tracking.cancelledAt = now;
  }

  if (
    nextStatus === "delivered" &&
    order.paymentMethod === "cod" &&
    order.paymentStatus !== "paid"
  ) {
    order.paymentStatus = "paid";
    await applyCommissionSnapshot(order);
    appendPaymentEvent(order, {
      status: "paid",
      provider: "cod",
      by: req.user.id,
      byRole: req.user.role,
      note: "Cash collected on delivery",
    });
  }

  order.statusHistory.push({
    status: nextStatus,
    changedBy: req.user.id,
    changedByRole: req.user.role,
    changedAt: now,
    note:
      typeof req.body.note === "string" && req.body.note.trim()
        ? req.body.note.trim().slice(0, 500)
        : "",
  });

  await order.save();

  // Fire-and-forget notifications based on the new status
  if (nextStatus === "shipped") {
    onOrderShipped(order);
  } else if (nextStatus === "delivered") {
    onOrderDelivered(order);
    if (order.paymentMethod === "cod" && order.paymentStatus === "paid") {
      onOrderPaymentSucceeded(order);
    }
  } else if (nextStatus === "cancelled") {
    onOrderCancelled(order, {
      reason:
        (typeof req.body.note === "string" && req.body.note.trim()) ||
        order.tracking?.cancellationReason ||
        "Order cancelled by vendor",
    });
  }

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
  res.status(200).json({
    message: "Order status updated",
    data: order,
  });
});

<<<<<<< HEAD
module.exports = {
  listOrders,
  getOrderById,
  updateOrderStatus,
=======
const addShipmentEvent = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

  validateShipmentEventPayload(req.body);

  // Tracking events make sense only after the shipment leaves the seller.
  // Allow events between "shipped" and "delivered" (and on a delivered
  // order's history, but reject for any earlier or terminal-cancelled state).
  if (order.orderStatus === "cancelled") {
    throw new ApiError(409, "Cannot add tracking events to a cancelled order");
  }
  if (!["shipped", "delivered"].includes(order.orderStatus)) {
    throw new ApiError(
      409,
      "Order must be shipped before adding tracking events"
    );
  }

  const eventDate = req.body.at ? new Date(req.body.at) : new Date();
  const newEvent = {
    status: req.body.status,
    at: eventDate,
    location: typeof req.body.location === "string" ? req.body.location : "",
    note: typeof req.body.note === "string" ? req.body.note : "",
    by: req.user.id,
    byRole: req.user.role,
  };
  order.tracking.events.push(newEvent);

  // Sort events chronologically so consumers always see them in order
  order.tracking.events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  await order.save();

  onShipmentEvent(order, newEvent);

  res.status(201).json({
    message: "Tracking event added",
    data: {
      orderNumber: order.orderNumber,
      tracking: order.tracking,
    },
  });
});

const listShipmentEvents = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

  await order.populate({
    path: "tracking.events.by",
    select: "name email role",
  });

  res.status(200).json({
    data: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      tracking: order.tracking,
    },
  });
});

module.exports = {
  listOrders,
  getOrderById,
  getOrderHistory,
  updateOrderStatus,
  addShipmentEvent,
  listShipmentEvents,
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
};
