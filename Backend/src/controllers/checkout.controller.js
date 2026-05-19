const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const env = require("../config/env");
const {
  buildLiveSnapshotForItem,
  getOrCreateCart,
} = require("../lib/cartUtils");
const {
  buildMethodSnapshot,
  computeShippingFeeForStore,
  findActiveShippingMethodsByStores,
} = require("../lib/shippingUtils");
const { getStripeClient, isStripeConfigured } = require("../lib/stripeClient");
const { appendPaymentEvent } = require("../lib/paymentService");
const {
  onOrderPlacedToCustomer,
  onOrderPlacedToVendor,
} = require("../lib/notificationHooks");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const PaymentTransaction = require("../models/PaymentTransaction");
const Product = require("../models/Product");
const StoreSettings = require("../models/StoreSettings");
const Store = require("../models/Store");
const User = require("../models/User");
const { validateCheckoutPayload } = require("../validators/checkout.validator");

const isReplicaSetTransactionError = (err) => {
  const msg = String(err?.message || "");
  return (
    err?.name === "MongoServerError" &&
    (msg.includes("replica set") ||
      msg.includes("mongos") ||
      msg.includes("Transaction numbers"))
  );
};

const resolveShippingAddress = (user, payload) => {
  if (payload.addressId) {
    const address = user.addresses.id(payload.addressId);
    if (!address) throw new ApiError(404, "Address not found in your profile");
    return {
      fullName: address.fullName || user.name,
      phone: address.phone || user.phone || "",
      line1: address.line1,
      line2: address.line2 || "",
      city: address.city,
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "",
    };
  }

  const a = payload.shippingAddress;
  return {
    fullName: (a.fullName || user.name || "").toString().trim(),
    phone: (a.phone || user.phone || "").toString().trim(),
    line1: a.line1.trim(),
    line2: (a.line2 || "").trim(),
    city: a.city.trim(),
    state: (a.state || "").trim(),
    postalCode: (a.postalCode || "").trim(),
    country: (a.country || "").trim(),
  };
};

const evaluateCart = async (cart) => {
  if (!cart.items || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  const evaluatedItems = [];
  for (const item of cart.items) {
    // eslint-disable-next-line no-await-in-loop
    const status = await buildLiveSnapshotForItem(item);
    evaluatedItems.push({ item, status });
  }

  return evaluatedItems;
};

const groupByStore = (evaluatedItems) => {
  const groups = new Map();
  for (const { item, status } of evaluatedItems) {
    if (!status.available) continue;
    const key = String(item.store);
    if (!groups.has(key)) {
      groups.set(key, { storeId: item.store, items: [] });
    }
    groups.get(key).items.push({ item, status });
  }
  return groups;
};

const buildSelectionMap = (selections) => {
  const map = new Map();
  if (!Array.isArray(selections)) return map;
  for (const sel of selections) {
    if (sel && sel.storeId) {
      map.set(
        String(sel.storeId),
        sel.shippingMethodId ? String(sel.shippingMethodId) : null
      );
    }
  }
  return map;
};

const resolveShippingForGroups = async ({ groups, selections, strict }) => {
  const storeIds = Array.from(groups.keys());
  const [settingsList, methodsByStore] = await Promise.all([
    storeIds.length
      ? StoreSettings.find({ store: { $in: storeIds } })
      : Promise.resolve([]),
    findActiveShippingMethodsByStores(storeIds),
  ]);
  const settingsByStore = new Map(
    settingsList.map((s) => [String(s.store), s])
  );

  const selectionMap = buildSelectionMap(selections);

  for (const group of groups.values()) {
    const storeKey = String(group.storeId);
    const settings = settingsByStore.get(storeKey);
    const methods = methodsByStore.get(storeKey) || [];

    let chosen = null;
    const selectedId = selectionMap.get(storeKey);
    if (selectedId) {
      chosen = methods.find((m) => String(m._id) === selectedId) || null;
      if (!chosen && strict) {
        throw new ApiError(
          400,
          "Selected shipping method is not available for this store"
        );
      }
    }
    if (!chosen) {
      chosen = methods[0] || null; // sorted by sortOrder, fee
    }

    group.shippingMethod = chosen;
    group.availableShippingMethods = methods;
    group.shippingSettings = settings;
  }
};

const computeStoreTotals = async (groups, selections = null) => {
  await resolveShippingForGroups({ groups, selections, strict: false });

  for (const group of groups.values()) {
    let subtotal = 0;
    for (const { item, status } of group.items) {
      const livePrice = Number(status.live.unitPrice);
      subtotal += livePrice * Number(item.quantity);
    }
    group.subtotal = subtotal;
    group.shippingFee = computeShippingFeeForStore({
      method: group.shippingMethod,
      settings: group.shippingSettings,
      subtotal,
    });
    group.total = subtotal + group.shippingFee;
  }
};

const buildPreviewResponse = async (evaluatedItems, selections = null) => {
  const items = evaluatedItems.map(({ item, status }) => ({
    _id: item._id,
    product: item.product,
    variantId: item.variantId,
    title: item.title,
    sku: item.sku,
    attributes: item.attributes,
    image: item.image,
    snapshotPrice: item.unitPrice,
    livePrice: status.live ? status.live.unitPrice : null,
    priceChanged: Boolean(status.live && status.live.priceChanged),
    quantity: item.quantity,
    available: status.available,
    reason: status.reason,
  }));

  const groups = groupByStore(evaluatedItems);
  await computeStoreTotals(groups, selections);

  const storeIds = Array.from(groups.keys()).map(
    (k) => new mongoose.Types.ObjectId(k)
  );
  const stores = storeIds.length
    ? await Store.find({ _id: { $in: storeIds } }).select("name slug")
    : [];
  const storesById = new Map(stores.map((s) => [String(s._id), s]));

  let subtotal = 0;
  let shippingFee = 0;
  const byStore = [];
  for (const group of groups.values()) {
    const store = storesById.get(String(group.storeId));
    byStore.push({
      storeId: group.storeId,
      storeName: store?.name || "",
      storeSlug: store?.slug || "",
      itemCount: group.items.reduce((acc, x) => acc + x.item.quantity, 0),
      subtotal: group.subtotal,
      shippingFee: group.shippingFee,
      total: group.total,
      availableShippingMethods: (group.availableShippingMethods || []).map(
        buildMethodSnapshot
      ),
      selectedShippingMethod: buildMethodSnapshot(group.shippingMethod),
    });
    subtotal += group.subtotal;
    shippingFee += group.shippingFee;
  }

  const blockingIssues = items.filter((x) => !x.available);

  return {
    items,
    byStore,
    subtotal,
    shippingFee,
    grandTotal: subtotal + shippingFee,
    canCheckout: blockingIssues.length === 0 && byStore.length > 0,
    issues: blockingIssues.map((x) => ({
      itemId: x._id,
      title: x.title,
      reason: x.reason,
    })),
  };
};

const parseSelectionsFromQuery = (query) => {
  if (!query || !query.shippingSelections) return null;
  if (typeof query.shippingSelections !== "string") return null;
  try {
    const parsed = JSON.parse(query.shippingSelections);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
};

const previewCheckout = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  if (!cart.items || cart.items.length === 0) {
    return res.status(200).json({
      data: {
        items: [],
        byStore: [],
        subtotal: 0,
        shippingFee: 0,
        grandTotal: 0,
        canCheckout: false,
        issues: [],
      },
    });
  }

  const evaluatedItems = await evaluateCart(cart);
  const selections = parseSelectionsFromQuery(req.query);
  const preview = await buildPreviewResponse(evaluatedItems, selections);
  res.status(200).json({ data: preview });
});

const decrementStockForItem = async (item, session) => {
  if (item.variantId) {
    const result = await Product.updateOne(
      {
        _id: item.product,
        isActive: true,
        variants: {
          $elemMatch: {
            _id: item.variantId,
            isActive: true,
            stock: { $gte: item.quantity },
          },
        },
      },
      { $inc: { "variants.$.stock": -Number(item.quantity) } },
      session ? { session } : {}
    );
    if (result.modifiedCount === 0) {
      throw new ApiError(409, `Stock changed for "${item.title}", please retry`);
    }
    return;
  }

  const result = await Product.updateOne(
    {
      _id: item.product,
      isActive: true,
      stock: { $gte: item.quantity },
    },
    { $inc: { stock: -Number(item.quantity) } },
    session ? { session } : {}
  );
  if (result.modifiedCount === 0) {
    throw new ApiError(409, `Stock changed for "${item.title}", please retry`);
  }
};

const incrementStockForItem = async (item, session) => {
  if (item.variantId) {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": Number(item.quantity) } },
      session ? { session } : {}
    );
    return;
  }
  await Product.updateOne(
    { _id: item.product },
    { $inc: { stock: Number(item.quantity) } },
    session ? { session } : {}
  );
};

const buildOrderItems = (groupItems) =>
  groupItems.map(({ item, status }) => {
    const unitPrice = Number(status.live.unitPrice);
    const total = unitPrice * Number(item.quantity);
    return {
      product: item.product,
      variantId: item.variantId,
      title: item.title,
      sku: item.sku,
      attributes: item.attributes,
      quantity: item.quantity,
      unitPrice,
      total,
    };
  });

const buildShippingMethodSnapshot = (method) => {
  if (!method) {
    return {
      id: null,
      code: "",
      name: "",
      description: "",
      fee: 0,
      minDays: 0,
      maxDays: 0,
    };
  }
  return {
    id: method._id,
    code: method.code || "",
    name: method.name || "",
    description: method.description || "",
    fee: Number(method.fee || 0),
    minDays: Number(method.minDays || 0),
    maxDays: Number(method.maxDays || 0),
  };
};

const buildOrderDoc = ({
  storeGroup,
  user,
  shippingAddress,
  paymentMethod,
  notePrefix,
}) => ({
  store: storeGroup.storeId,
  customer: user._id,
  customerSnapshot: {
    name: user.name,
    email: user.email,
    phone: user.phone || "",
  },
  shippingAddress,
  items: buildOrderItems(storeGroup.items),
  subtotal: storeGroup.subtotal,
  shippingFee: storeGroup.shippingFee,
  total: storeGroup.total,
  paymentMethod,
  paymentStatus: "pending",
  orderStatus: "pending",
  statusHistory: [
    {
      status: "pending",
      changedBy: user._id,
      changedByRole: "customer",
      changedAt: new Date(),
      note: notePrefix || "Order placed",
    },
  ],
  shippingMethod: buildShippingMethodSnapshot(storeGroup.shippingMethod),
});

const placeOrdersWithTransaction = async ({
  cart,
  storeGroups,
  user,
  shippingAddress,
  paymentMethod,
  notes,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const group of storeGroups.values()) {
      for (const { item } of group.items) {
        // eslint-disable-next-line no-await-in-loop
        await decrementStockForItem(item, session);
      }
    }

    const orderDocs = Array.from(storeGroups.values()).map((group) =>
      buildOrderDoc({
        storeGroup: group,
        user,
        shippingAddress,
        paymentMethod,
        notePrefix: notes ? `Order placed. Note: ${notes}` : "Order placed",
      })
    );

    const orders = await Order.create(orderDocs, { session });

    await Cart.updateOne(
      { _id: cart._id },
      { $set: { items: [] } },
      { session }
    );

    await session.commitTransaction();
    return orders;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_abortErr) {
      // ignore
    }
    throw err;
  } finally {
    session.endSession();
  }
};

const placeOrdersWithCompensation = async ({
  cart,
  storeGroups,
  user,
  shippingAddress,
  paymentMethod,
  notes,
}) => {
  const decrementedItems = [];
  const createdOrderIds = [];

  try {
    for (const group of storeGroups.values()) {
      for (const { item } of group.items) {
        // eslint-disable-next-line no-await-in-loop
        await decrementStockForItem(item, null);
        decrementedItems.push(item);
      }
    }

    const orders = [];
    for (const group of storeGroups.values()) {
      const doc = buildOrderDoc({
        storeGroup: group,
        user,
        shippingAddress,
        paymentMethod,
        notePrefix: notes ? `Order placed. Note: ${notes}` : "Order placed",
      });
      // eslint-disable-next-line no-await-in-loop
      const order = await Order.create(doc);
      createdOrderIds.push(order._id);
      orders.push(order);
    }

    await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } });

    return orders;
  } catch (err) {
    for (const item of decrementedItems) {
      // eslint-disable-next-line no-await-in-loop
      await incrementStockForItem(item, null).catch(() => { });
    }
    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } }).catch(() => { });
    }
    throw err;
  }
};

const buildStripeLineItems = (orders, currency) => {
  const lineItems = [];
  for (const order of orders) {
    for (const item of order.items) {
      lineItems.push({
        quantity: Number(item.quantity),
        price_data: {
          currency,
          unit_amount: Math.round(Number(item.unitPrice) * 100),
          product_data: {
            name: item.title,
            metadata: {
              orderNumber: order.orderNumber,
              productId: String(item.product),
              variantId: item.variantId ? String(item.variantId) : "",
              sku: item.sku || "",
            },
          },
        },
      });
    }
    if (order.shippingFee && Number(order.shippingFee) > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(Number(order.shippingFee) * 100),
          product_data: {
            name: `Shipping (${order.orderNumber})`,
          },
        },
      });
    }
  }
  return lineItems;
};

const createStripeSessionForOrders = async ({ orders, user, transactionId }) => {
  const stripe = getStripeClient();
  const currency = env.platformCurrency;
  const orderNumbers = orders.map((o) => o.orderNumber).join(",");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email,
    line_items: buildStripeLineItems(orders, currency),
    success_url: `${env.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.stripe.cancelUrl}?session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      transactionId: String(transactionId),
      userId: String(user._id),
      orderNumbers,
    },
  });

  return session;
};

const placeOrder = asyncHandler(async (req, res) => {
  validateCheckoutPayload(req.body);

  if (req.body.paymentMethod === "online" && !isStripeConfigured()) {
    throw new ApiError(
      503,
      "Online payments are not configured on this server"
    );
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const shippingAddress = resolveShippingAddress(user, req.body);

  const cart = await getOrCreateCart(req.user.id);
  if (!cart.items || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  const evaluatedItems = await evaluateCart(cart);
  const blocking = evaluatedItems.filter(({ status }) => !status.available);
  if (blocking.length > 0) {
    throw new ApiError(409, "Some items are no longer available; review your cart");
  }

  const storeGroups = groupByStore(evaluatedItems);
  if (storeGroups.size === 0) {
    throw new ApiError(400, "Cart has no eligible items to checkout");
  }

  // Strict resolve: if a selection points at a non-existent or inactive method
  // for that store, reject the checkout request.
  await resolveShippingForGroups({
    groups: storeGroups,
    selections: req.body.shippingSelections,
    strict: true,
  });

  // Recompute subtotals + shipping using the resolved methods.
  for (const group of storeGroups.values()) {
    let subtotal = 0;
    for (const { item, status } of group.items) {
      subtotal += Number(status.live.unitPrice) * Number(item.quantity);
    }
    group.subtotal = subtotal;
    group.shippingFee = computeShippingFeeForStore({
      method: group.shippingMethod,
      settings: group.shippingSettings,
      subtotal,
    });
    group.total = subtotal + group.shippingFee;
  }

  let orders;
  try {
    orders = await placeOrdersWithTransaction({
      cart,
      storeGroups,
      user,
      shippingAddress,
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes,
    });
  } catch (err) {
    if (isReplicaSetTransactionError(err)) {
      orders = await placeOrdersWithCompensation({
        cart,
        storeGroups,
        user,
        shippingAddress,
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes,
      });
    } else {
      throw err;
    }
  }

  // Record initial pending payment event for every order
  for (const order of orders) {
    appendPaymentEvent(order, {
      status: "pending",
      provider: req.body.paymentMethod === "online" ? "stripe" : "cod",
      note:
        req.body.paymentMethod === "online"
          ? "Awaiting online payment"
          : "Cash on Delivery — awaiting collection",
      by: user._id,
      byRole: "customer",
    });
    // eslint-disable-next-line no-await-in-loop
    await order.save();
  }

  // Fire-and-forget notifications: customer confirmation + per-store vendor alert
  for (const order of orders) {
    onOrderPlacedToCustomer(order, user);
    // No await — onOrderPlacedToVendor schedules its own async dispatch
    onOrderPlacedToVendor(order, user);
  }

  let paymentPayload = null;

  if (req.body.paymentMethod === "online") {
    const totalAmount = orders.reduce((acc, o) => acc + Number(o.total), 0);

    const transaction = await PaymentTransaction.create({
      user: user._id,
      orders: orders.map((o) => o._id),
      provider: "stripe",
      status: "pending",
      amount: totalAmount,
      currency: env.platformCurrency,
    });

    try {
      const session = await createStripeSessionForOrders({
        orders,
        user,
        transactionId: transaction._id,
      });

      transaction.providerSessionId = session.id;
      transaction.checkoutUrl = session.url;
      transaction.status = "processing";
      transaction.events.push({
        type: "stripe.checkout.session.created",
        status: "processing",
        at: new Date(),
      });
      await transaction.save();

      await Order.updateMany(
        { _id: { $in: orders.map((o) => o._id) } },
        { $set: { paymentTransaction: transaction._id } }
      );

      paymentPayload = {
        provider: "stripe",
        transactionId: transaction._id,
        sessionId: session.id,
        url: session.url,
        amount: totalAmount,
        currency: env.platformCurrency,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000)
          : null,
      };
    } catch (err) {
      transaction.status = "failed";
      transaction.failureReason =
        err?.message || "Failed to create Stripe session";
      transaction.events.push({
        type: "stripe.checkout.session.create_failed",
        status: "failed",
        at: new Date(),
        note: transaction.failureReason,
      });
      await transaction.save();
      throw new ApiError(
        502,
        "Payment provider error. Your order is held; please retry payment."
      );
    }
  }

  res.status(201).json({
    message: "Order placed",
    data: {
      orders: orders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        store: o.store,
        total: o.total,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
      })),
      payment: paymentPayload,
    },
  });
});

module.exports = {
  previewCheckout,
  placeOrder,
};
