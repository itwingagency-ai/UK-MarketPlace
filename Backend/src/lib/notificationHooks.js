const env = require("../config/env");
const Store = require("../models/Store");
const User = require("../models/User");
const { notifyAsync } = require("./notificationDispatcher");

const formatMoney = (value, currency) => {
  const n = Number(value || 0);
  const formatted = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  return currency ? `${formatted}` : formatted;
};

const trackUrlFor = (orderNumber, email) => {
  if (!orderNumber) return env.appUrl;
  const base = env.appUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  const qs = params.toString();
  return `${base}/track/${orderNumber}${qs ? `?${qs}` : ""}`;
};

const dashboardUrl = () => `${env.appUrl.replace(/\/+$/, "")}/vendor/dashboard`;
const loginUrl = () => `${env.appUrl.replace(/\/+$/, "")}/login`;
const retryUrl = (transactionId) =>
  transactionId
    ? `${env.appUrl.replace(/\/+$/, "")}/checkout/retry/${transactionId}`
    : `${env.appUrl.replace(/\/+$/, "")}/account/orders`;

const onAccountWelcome = (user) => {
  if (!user?._id) return;
  notifyAsync({
    user,
    eventType: "account.welcome",
    context: {
      name: user.name || "",
      email: user.email || "",
      loginUrl: loginUrl(),
    },
  });
};

const onPasswordChanged = (user) => {
  if (!user?._id) return;
  notifyAsync({
    user,
    eventType: "account.password_changed",
    context: {
      name: user.name || "",
      email: user.email || "",
    },
  });
};

const onOrderPlacedToCustomer = async (order, user) => {
  if (!order || !user?._id) return;
  let storeName = "";
  try {
    if (order.store) {
      const store = await Store.findById(order.store).select("name");
      storeName = store?.name || "";
    }
  } catch (_err) {
    // swallow — storeName is best-effort
  }
  notifyAsync({
    user,
    eventType: "order.placed.customer",
    context: {
      name: user.name || "",
      orderNumber: order.orderNumber || "",
      storeName,
      total: formatMoney(order.total),
      currency: (order.currency || env.platformCurrency || "").toUpperCase(),
      paymentMethod: order.paymentMethod || "",
      trackUrl: trackUrlFor(order.orderNumber, user.email),
    },
    related: { order: order._id, store: order.store },
  });
};

const onOrderPlacedToVendor = async (order, customer) => {
  if (!order?.store) return;
  try {
    const store = await Store.findById(order.store).populate("owner");
    if (!store?.owner) return;
    notifyAsync({
      user: store.owner,
      eventType: "order.placed.vendor",
      context: {
        vendorName: store.owner.name || "",
        storeName: store.name || "",
        orderNumber: order.orderNumber || "",
        customerName: customer?.name || "",
        total: formatMoney(order.total),
        currency: (order.currency || env.platformCurrency || "").toUpperCase(),
        dashboardUrl: dashboardUrl(),
      },
      related: { order: order._id, store: store._id },
    });
  } catch (_err) {
    // swallow — notifications must not break the request
  }
};

const onOrderPaymentSucceeded = async (order) => {
  if (!order?.customer) return;
  try {
    const user = await User.findById(order.customer);
    if (!user) return;
    notifyAsync({
      user,
      eventType: "order.payment_succeeded",
      context: {
        name: user.name || "",
        orderNumber: order.orderNumber || "",
        total: formatMoney(order.total),
        currency: (env.platformCurrency || "").toUpperCase(),
        trackUrl: trackUrlFor(order.orderNumber, user.email),
      },
      related: { order: order._id, store: order.store },
    });
  } catch (_err) {
    // swallow
  }
};

const onOrderPaymentFailed = async (order, { reason, transactionId } = {}) => {
  if (!order?.customer) return;
  try {
    const user = await User.findById(order.customer);
    if (!user) return;
    notifyAsync({
      user,
      eventType: "order.payment_failed",
      context: {
        name: user.name || "",
        orderNumber: order.orderNumber || "",
        reason: reason || "Payment was not completed",
        retryUrl: retryUrl(transactionId),
      },
      related: { order: order._id, store: order.store },
    });
  } catch (_err) {
    // swallow
  }
};

const onOrderShipped = async (order) => {
  if (!order?.customer) return;
  try {
    const user = await User.findById(order.customer);
    if (!user) return;
    const tracking = order.tracking || {};
    const eta = {
      etaMin: tracking.estimatedDeliveryEarliest
        ? new Date(tracking.estimatedDeliveryEarliest)
            .toISOString()
            .slice(0, 10)
        : "",
      etaMax: tracking.estimatedDeliveryLatest
        ? new Date(tracking.estimatedDeliveryLatest).toISOString().slice(0, 10)
        : "",
    };
    notifyAsync({
      user,
      eventType: "order.shipped",
      context: {
        name: user.name || "",
        orderNumber: order.orderNumber || "",
        carrier: tracking.carrier || "",
        trackingNumber: tracking.trackingNumber || "",
        trackingUrl: tracking.trackingUrl || "",
        ...eta,
        trackUrl: trackUrlFor(order.orderNumber, user.email),
      },
      related: { order: order._id, store: order.store },
    });
  } catch (_err) {
    // swallow
  }
};

const onOrderDelivered = async (order) => {
  if (!order?.customer) return;
  try {
    const user = await User.findById(order.customer);
    if (!user) return;
    notifyAsync({
      user,
      eventType: "order.delivered",
      context: {
        name: user.name || "",
        orderNumber: order.orderNumber || "",
      },
      related: { order: order._id, store: order.store },
    });
  } catch (_err) {
    // swallow
  }
};

const onOrderCancelled = async (order, { reason } = {}) => {
  if (!order?.customer) return;
  try {
    const user = await User.findById(order.customer);
    if (!user) return;
    notifyAsync({
      user,
      eventType: "order.cancelled",
      context: {
        name: user.name || "",
        orderNumber: order.orderNumber || "",
        reason:
          reason ||
          order.tracking?.cancellationReason ||
          "Order was cancelled",
      },
      related: { order: order._id, store: order.store },
    });
  } catch (_err) {
    // swallow
  }
};

const onShipmentEvent = async (order, event) => {
  if (!order?.customer || !event) return;
  try {
    const user = await User.findById(order.customer);
    if (!user) return;
    notifyAsync({
      user,
      eventType: "order.shipment_event",
      context: {
        name: user.name || "",
        orderNumber: order.orderNumber || "",
        eventStatus: event.status || "",
        location: event.location || "",
        note: event.note || "",
        trackUrl: trackUrlFor(order.orderNumber, user.email),
      },
      related: { order: order._id, store: order.store },
    });
  } catch (_err) {
    // swallow
  }
};

const onVendorApplicationSubmitted = async (applicant, application) => {
  if (!applicant?._id) return;
  try {
    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      notifyAsync({
        user: admin,
        eventType: "admin.vendor_application_submitted",
        context: {
          applicantName: applicant.name || "",
          storeName: application.storeName || "",
          dashboardUrl: `${env.appUrl.replace(/\/+$/, "")}/admin/vendor-applications`,
        },
        related: {
          vendorApplication: application?._id || null,
        },
      });
    }
  } catch (_err) {
    // swallow
  }
};

const onVendorApplicationApproved = async (applicant, store, application) => {
  if (!applicant?._id) return;
  notifyAsync({
    user: applicant,
    eventType: "vendor.application_approved",
    context: {
      name: applicant.name || "",
      storeName: store?.name || "",
      dashboardUrl: dashboardUrl(),
    },
    related: {
      store: store?._id || null,
      vendorApplication: application?._id || null,
    },
  });
};

const onVendorApplicationRejected = async (applicant, application, reason) => {
  if (!applicant?._id) return;
  notifyAsync({
    user: applicant,
    eventType: "vendor.application_rejected",
    context: {
      name: applicant.name || "",
      reason: reason || application?.adminNote || "",
    },
    related: {
      vendorApplication: application?._id || null,
    },
  });
};

const onReviewSubmitted = async ({ review, product, customer }) => {
  if (!review || !product) return;
  try {
    const store = await Store.findById(review.store).populate("owner");
    if (!store?.owner) return;
    notifyAsync({
      user: store.owner,
      eventType: "review.submitted.vendor",
      context: {
        vendorName: store.owner.name || "",
        storeName: store.name || "",
        productTitle: product.title || "",
        rating: String(review.rating || ""),
        customerName: customer?.name || review.userSnapshot?.name || "",
        dashboardUrl: dashboardUrl(),
      },
      related: { store: store._id },
    });
  } catch (_err) {
    // swallow — notifications never break write paths
  }
};

const onVendorReviewResponse = async ({ review, product, store }) => {
  if (!review?.user) return;
  try {
    const user = await User.findById(review.user);
    if (!user) return;
    const snippet = (review.vendorResponse?.body || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    const base = env.appUrl.replace(/\/+$/, "");
    notifyAsync({
      user,
      eventType: "review.responded.customer",
      context: {
        name: user.name || "",
        storeName: store?.name || "",
        productTitle: product?.title || "",
        responseSnippet: snippet,
        reviewUrl: `${base}/account/reviews/${review._id}`,
      },
      related: { store: store?._id || null },
    });
  } catch (_err) {
    // swallow
  }
};

module.exports = {
  onAccountWelcome,
  onPasswordChanged,
  onOrderPlacedToCustomer,
  onOrderPlacedToVendor,
  onOrderPaymentSucceeded,
  onOrderPaymentFailed,
  onOrderShipped,
  onOrderDelivered,
  onOrderCancelled,
  onShipmentEvent,
  onVendorApplicationSubmitted,
  onVendorApplicationApproved,
  onVendorApplicationRejected,
  onReviewSubmitted,
  onVendorReviewResponse,
};
