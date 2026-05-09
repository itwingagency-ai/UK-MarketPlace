const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");

const buildShipmentEvents = (tracking) =>
  ((tracking && tracking.events) || []).map((event) => ({
    status: event.status,
    at: event.at,
    location: event.location || "",
    note: event.note || "",
  }));

const buildPublicOrderView = (order, store) => {
  const tracking = order.tracking || {};
  return {
    orderNumber: order.orderNumber,
    store: store
      ? { name: store.name, slug: store.slug }
      : { name: "", slug: "" },
    placedAt: order.createdAt,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: order.total,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    shippingMethod: order.shippingMethod
      ? {
          name: order.shippingMethod.name || "",
          code: order.shippingMethod.code || "",
          minDays: order.shippingMethod.minDays || 0,
          maxDays: order.shippingMethod.maxDays || 0,
        }
      : null,
    items: (order.items || []).map((item) => ({
      title: item.title,
      sku: item.sku,
      attributes: item.attributes,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    shippingAddress: order.shippingAddress || {},
    tracking: {
      carrier: tracking.carrier || "",
      trackingNumber: tracking.trackingNumber || "",
      trackingUrl: tracking.trackingUrl || "",
      shippedAt: tracking.shippedAt || null,
      deliveredAt: tracking.deliveredAt || null,
      cancelledAt: tracking.cancelledAt || null,
      estimatedDeliveryEarliest: tracking.estimatedDeliveryEarliest || null,
      estimatedDeliveryLatest: tracking.estimatedDeliveryLatest || null,
      events: buildShipmentEvents(tracking),
    },
    statusHistory: (order.statusHistory || []).map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      note: entry.note,
    })),
  };
};

const trackOrderByNumber = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const email = (req.query.email || "").toString().trim().toLowerCase();

  if (!orderNumber) throw new ApiError(400, "orderNumber is required");
  if (!email) throw new ApiError(400, "email query parameter is required");

  const order = await Order.findOne({ orderNumber }).populate(
    "store",
    "name slug"
  );

  if (
    !order ||
    !order.customerSnapshot ||
    (order.customerSnapshot.email || "").toLowerCase() !== email
  ) {
    throw new ApiError(404, "Order not found");
  }

  res.status(200).json({
    data: buildPublicOrderView(order, order.store),
  });
});

module.exports = {
  trackOrderByNumber,
};
