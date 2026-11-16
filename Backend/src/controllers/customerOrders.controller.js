const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const {
  buildCartSummary,
  findCartItem,
  getOrCreateCart,
  resolveProductForCart,
} = require("../lib/cartUtils");
const { ALLOWED_STATUSES } = require("../validators/order.validator");
const {
  refundOrderIfPaid,
  releaseCancelledOrder,
} = require("../lib/paymentService");
const { notifyCustomerArrived, notifyOrderStatus } = require("../lib/appNotifications");
const { emitCustomerArrived, emitOrderStatusChanged } = require("../lib/orderEvents");
const { onOrderCancelled } = require("../lib/notificationHooks");

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
        estimatedReadyAt: tracking.estimatedReadyAt || null,
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

/**
 * POST /customer/orders/:id/reorder
 * Put a past order's items back in the basket at today's prices, capped at
 * what is in stock. Items that can't be bought any more are reported back.
 */
const reorder = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid order id");
  }
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.id }).select("items");
  if (!order) throw new ApiError(404, "Order not found");

  const cart = await getOrCreateCart(req.user.id);
  const added = [];
  const skipped = [];

  for (const item of order.items) {
    let resolved;
    try {
      // eslint-disable-next-line no-await-in-loop
      resolved = await resolveProductForCart({ productId: item.product, variantId: item.variantId || null });
    } catch (err) {
      skipped.push({ title: item.title, reason: err.message || "No longer available" });
      continue;
    }

    const existing = findCartItem(cart, resolved.product._id, item.variantId || null);
    const inCart = existing ? existing.quantity : 0;
    const room = Math.min(resolved.availableStock, 999) - inCart;
    const quantity = Math.min(Number(item.quantity), room);
    if (quantity <= 0) {
      skipped.push({ title: item.title, reason: resolved.availableStock <= 0 ? "Out of stock" : "Already in your basket" });
      continue;
    }

    const fields = {
      unitPrice: resolved.unitPrice,
      compareAtPrice: resolved.compareAtPrice,
      title: resolved.title,
      sku: resolved.sku,
      attributes: resolved.attributes,
      image: resolved.image,
    };
    if (existing) {
      Object.assign(existing, fields, { quantity: inCart + quantity });
    } else {
      cart.items.push({
        ...fields,
        product: resolved.product._id,
        store: resolved.storeId,
        variantId: item.variantId || null,
        quantity,
      });
    }
    added.push({ title: item.title, quantity, partial: quantity < Number(item.quantity) });
  }

  if (added.length > 0) await cart.save();
  const summary = await buildCartSummary(cart);
  res.status(200).json({
    message: added.length ? "Items added to your basket" : "Nothing could be added",
    data: { added, skipped, cart: summary },
  });
});

/**
 * POST /customer/orders/:id/cancel
 * A customer can cancel only while the store hasn't accepted the order yet.
 * Stock goes back on the shelf and a card payment is refunded.
 */
const cancelMyOrder = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid order id");
  }

  const reason =
    typeof req.body?.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 500)
      : "Cancelled by customer";
  const now = new Date();

  // Conditional update, so a vendor accepting at the same moment wins cleanly
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, customer: req.user.id, orderStatus: "pending" },
    {
      $set: {
        orderStatus: "cancelled",
        "tracking.cancelledAt": now,
        "tracking.cancellationReason": reason,
      },
      $push: {
        statusHistory: {
          status: "cancelled",
          changedBy: req.user.id,
          changedByRole: "customer",
          changedAt: now,
          note: reason,
        },
      },
    },
    { new: true }
  );

  if (!order) {
    const current = await Order.findOne({ _id: req.params.id, customer: req.user.id }).select("orderStatus");
    if (!current) throw new ApiError(404, "Order not found");
    if (current.orderStatus === "cancelled") throw new ApiError(409, "This order is already cancelled");
    throw new ApiError(409, "This order can no longer be cancelled — the store has already accepted it");
  }

  await releaseCancelledOrder(order, { reason });
  const refund = await refundOrderIfPaid(order, {
    by: req.user.id,
    byRole: "customer",
    reason: "Refunded after customer cancellation",
  });

  emitOrderStatusChanged(order, "pending");
  notifyOrderStatus(order);
  onOrderCancelled(order, { reason });

  res.status(200).json({
    message: refund.refunded
      ? "Order cancelled. Your refund is on its way."
      : "Order cancelled",
    data: order,
  });
});

/**
 * POST /customer/orders/:id/arrived { note? }
 * The customer is outside to collect. Tells the store's devices straight away
 * (Socket.IO + push). Can be sent again, e.g. to update the note.
 */
const markArrived = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid order id");
  }
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : "";
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.id });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.fulfilment?.method !== "collection") {
    throw new ApiError(409, "This order is being delivered, not collected");
  }
  if (!["confirmed", "packed", "ready_for_collection"].includes(order.orderStatus)) {
    throw new ApiError(
      409,
      order.orderStatus === "pending"
        ? "The store hasn't accepted this order yet"
        : "This order can't be collected any more"
    );
  }

  order.fulfilment.arrivedAt = new Date();
  order.fulfilment.arrivalNote = note;
  await order.save();

  emitCustomerArrived(order);
  notifyCustomerArrived(order);

  res.status(200).json({ message: "The store knows you're here", data: order });
});

module.exports = {
  markArrived,
  cancelMyOrder,
  reorder,
  listMyOrders,
  getMyOrderById,
  getMyOrderHistory,
};
