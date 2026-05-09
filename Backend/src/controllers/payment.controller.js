const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const env = require("../config/env");
const { getStripeClient, isStripeConfigured } = require("../lib/stripeClient");
const {
  appendPaymentEvent,
  applyCommissionSnapshot,
  cancelOrdersAndRestoreStock,
  finalizeTransaction,
  markOrdersPaid,
  recordTransactionEvent,
} = require("../lib/paymentService");
const { onOrderPaymentSucceeded } = require("../lib/notificationHooks");
const Order = require("../models/Order");
const PaymentTransaction = require("../models/PaymentTransaction");

const findUserTransaction = async (userId, transactionId) => {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    throw new ApiError(400, "Invalid transaction id");
  }
  const tx = await PaymentTransaction.findOne({
    _id: transactionId,
    user: userId,
  });
  if (!tx) throw new ApiError(404, "Transaction not found");
  return tx;
};

const getMyTransaction = asyncHandler(async (req, res) => {
  const tx = await findUserTransaction(req.user.id, req.params.transactionId);
  res.status(200).json({
    data: {
      id: tx._id,
      status: tx.status,
      provider: tx.provider,
      amount: tx.amount,
      currency: tx.currency,
      orders: tx.orders,
      checkoutUrl: tx.checkoutUrl,
      providerSessionId: tx.providerSessionId,
      providerIntentId: tx.providerIntentId,
      failureReason: tx.failureReason,
      paidAt: tx.paidAt,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    },
  });
});

const retryPayment = asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    throw new ApiError(
      503,
      "Online payments are not configured on this server"
    );
  }

  const tx = await findUserTransaction(req.user.id, req.params.transactionId);

  if (tx.provider !== "stripe") {
    throw new ApiError(400, "Only stripe transactions can be retried");
  }
  if (["succeeded", "refunded"].includes(tx.status)) {
    throw new ApiError(409, "This transaction is already completed");
  }

  const orders = await Order.find({ _id: { $in: tx.orders } });
  const allCancellable = orders.every(
    (o) => o.orderStatus !== "cancelled" && o.paymentStatus !== "paid"
  );
  if (!allCancellable) {
    throw new ApiError(409, "Linked orders are no longer eligible for retry");
  }

  const stripe = getStripeClient();
  const orderNumbers = orders.map((o) => o.orderNumber).join(",");

  const lineItems = [];
  for (const order of orders) {
    for (const item of order.items) {
      lineItems.push({
        quantity: Number(item.quantity),
        price_data: {
          currency: tx.currency,
          unit_amount: Math.round(Number(item.unitPrice) * 100),
          product_data: { name: item.title },
        },
      });
    }
    if (Number(order.shippingFee) > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: tx.currency,
          unit_amount: Math.round(Number(order.shippingFee) * 100),
          product_data: { name: `Shipping (${order.orderNumber})` },
        },
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: req.user.email || undefined,
    line_items: lineItems,
    success_url: `${env.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.stripe.cancelUrl}?session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      transactionId: String(tx._id),
      userId: String(req.user.id),
      orderNumbers,
      retry: "true",
    },
  });

  tx.providerSessionId = session.id;
  tx.checkoutUrl = session.url;
  tx.status = "processing";
  tx.failureReason = "";
  tx.events.push({
    type: "stripe.checkout.session.created",
    status: "processing",
    at: new Date(),
    note: "Retry payment",
  });
  await tx.save();

  res.status(200).json({
    message: "Retry session created",
    data: {
      transactionId: tx._id,
      sessionId: session.id,
      url: session.url,
    },
  });
});

const markCodCollected = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (!order) throw new ApiError(404, "Order not found");

  if (order.paymentMethod !== "cod") {
    throw new ApiError(400, "Only COD orders can be marked collected");
  }
  if (order.paymentStatus === "paid") {
    throw new ApiError(409, "Order is already marked as paid");
  }
  if (order.orderStatus === "cancelled") {
    throw new ApiError(409, "Cancelled orders cannot be marked paid");
  }

  order.paymentStatus = "paid";
  await applyCommissionSnapshot(order);
  appendPaymentEvent(order, {
    status: "paid",
    provider: "cod",
    by: req.user.id,
    byRole: req.user.role,
    note:
      typeof req.body?.note === "string" && req.body.note.trim()
        ? req.body.note.trim().slice(0, 500)
        : "Cash collected",
  });

  await order.save();
  onOrderPaymentSucceeded(order);

  res.status(200).json({
    message: "Order marked as paid",
    data: {
      id: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paymentEvents: order.paymentEvents,
    },
  });
});

const handleStripeWebhook = asyncHandler(async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ message: "Stripe not configured" });
  }
  if (!env.stripe.webhookSecret) {
    return res
      .status(503)
      .json({ message: "Stripe webhook secret not configured" });
  }

  const stripe = getStripeClient();
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripe.webhookSecret
    );
  } catch (err) {
    return res.status(400).json({
      message: `Webhook signature verification failed: ${err.message}`,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const transactionId = session?.metadata?.transactionId;
        if (!transactionId) break;

        const tx = await PaymentTransaction.findById(transactionId);
        if (!tx) break;

        if (tx.status === "succeeded") break;

        await finalizeTransaction(tx, {
          status: "succeeded",
          providerIntentId: session.payment_intent || tx.providerIntentId,
          paidAt: new Date(),
        });
        await recordTransactionEvent(tx, {
          type: event.type,
          status: "succeeded",
          note: "Stripe checkout completed",
          raw: { id: session.id },
        });

        await markOrdersPaid({
          orderIds: tx.orders,
          provider: "stripe",
          providerRef: session.payment_intent || session.id,
          paidAt: new Date(),
          note: "Stripe payment captured",
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const transactionId = session?.metadata?.transactionId;
        if (!transactionId) break;

        const tx = await PaymentTransaction.findById(transactionId);
        if (!tx || tx.status === "succeeded") break;

        await finalizeTransaction(tx, {
          status: "expired",
          failureReason: "Checkout session expired",
        });
        await recordTransactionEvent(tx, {
          type: event.type,
          status: "expired",
          note: "Stripe checkout session expired",
        });

        await cancelOrdersAndRestoreStock({
          orderIds: tx.orders,
          reason: "Checkout session expired before payment",
          provider: "stripe",
          providerRef: session.id,
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        const transactionId = intent?.metadata?.transactionId;
        let tx = null;
        if (transactionId) {
          tx = await PaymentTransaction.findById(transactionId);
        }
        if (!tx) {
          tx = await PaymentTransaction.findOne({
            providerIntentId: intent.id,
          });
        }
        if (!tx || tx.status === "succeeded") break;

        const failureReason =
          intent.last_payment_error?.message || "Payment failed";

        await finalizeTransaction(tx, {
          status: "failed",
          providerIntentId: intent.id,
          failureReason,
        });
        await recordTransactionEvent(tx, {
          type: event.type,
          status: "failed",
          note: failureReason,
        });

        await cancelOrdersAndRestoreStock({
          orderIds: tx.orders,
          reason: failureReason,
          provider: "stripe",
          providerRef: intent.id,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const tx = await PaymentTransaction.findOne({
          $or: [
            { providerChargeId: charge.id },
            { providerIntentId: charge.payment_intent },
          ],
        });
        if (!tx) break;

        await finalizeTransaction(tx, {
          status: "refunded",
          providerChargeId: charge.id,
        });
        await recordTransactionEvent(tx, {
          type: event.type,
          status: "refunded",
          note: "Stripe charge refunded",
        });

        const orders = await Order.find({ _id: { $in: tx.orders } });
        for (const order of orders) {
          if (order.paymentStatus !== "refunded") {
            order.paymentStatus = "refunded";
            appendPaymentEvent(order, {
              status: "refunded",
              provider: "stripe",
              providerRef: charge.id,
              note: "Refunded via Stripe",
            });
            // eslint-disable-next-line no-await-in-loop
            await order.save();
          }
        }
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ message: "Webhook handler error" });
  }
});

module.exports = {
  getMyTransaction,
  retryPayment,
  markCodCollected,
  handleStripeWebhook,
};
