const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const env = require("../config/env");
const {
  buildLiveSnapshotForItem,
  getOrCreateCart,
  mapToObject,
} = require("../lib/cartUtils");
const {
  buildMethodSnapshot,
  findActiveShippingMethodsByStores,
} = require("../lib/shippingUtils");
const { orderPricingFields } = require("../lib/pricing");
const { priceCartWithOffers } = require("../lib/offers");
const { claimCouponRedemptions } = require("../lib/couponRedemptions");
const { claimSlots } = require("../lib/slotBookings");
const { STORE_FULFILMENT_FIELDS, choiceFor, resolveFulfilment } = require("../lib/fulfilment");
const { getPlatformCurrency } = require("../lib/currency");
const { getStripeClient, isStripeConfigured } = require("../lib/stripeClient");
const { appendPaymentEvent } = require("../lib/paymentService");
const {
  onOrderPlacedToCustomer,
  onOrderPlacedToVendor,
} = require("../lib/notificationHooks");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const PaymentTransaction = require("../models/PaymentTransaction");
const PlatformSettings = require("../models/PlatformSettings");
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
      msg.includes("Transaction numbers") ||
      msg.includes("retryable writes"))
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

// Price every store group at live prices with the cart's coupons, tips and
// fee choices (lib/offers -> lib/pricing own the arithmetic).
// Call after resolveShippingForGroups. Returns the offers result
// (coupon statuses, near misses, blocking issues).
const priceGroups = async (groups, { cart, userId }) => {
  const list = Array.from(groups.values());
  const stores = list.length
    ? await Store.find({ _id: { $in: list.map((g) => g.storeId) } }).select(
      `slug location locationSet deliveryRadiusKm minimumOrder ${STORE_FULFILMENT_FIELDS}`
    )
    : [];
  const storesById = new Map(stores.map((st) => [String(st._id), st]));

  for (const group of list) {
    group.store = storesById.get(String(group.storeId)) || null;
    // eslint-disable-next-line no-await-in-loop
    group.fulfilment = await resolveFulfilment({ store: group.store, choice: choiceFor(cart, group.storeId) });
    // Collected orders have no delivery method
    if (group.fulfilment.method === "collection") group.shippingMethod = null;
  }

  const result = await priceCartWithOffers({
    cart,
    userId,
    groups: list.map((group) => {
      return {
        storeId: group.storeId,
        store: group.store,
        settings: group.shippingSettings,
        shippingMethod: group.shippingMethod,
        method: group.fulfilment.method,
        items: group.items.map(({ item, status }) => ({
          product: item.product,
          unitPrice: Number(status.live.unitPrice),
          quantity: Number(item.quantity),
        })),
      };
    }),
  });

  list.forEach((group, i) => {
    const priced = result.groups[i].priced;
    group.priced = priced;
    group.offers = result.groups[i];
    group.subtotal = priced.subtotal;
    group.shippingFee = priced.shippingFee;
    group.total = priced.total;
  });
  result.blockingIssues = [
    ...result.blockingIssues,
    ...list
      .filter((g) => g.fulfilment.issue)
      .map((g) => ({ kind: "fulfilment", storeId: g.storeId, message: g.fulfilment.issue })),
  ];
  return result;
};

const computeStoreTotals = async (groups, selections, ctx) => {
  await resolveShippingForGroups({ groups, selections, strict: false });
  return priceGroups(groups, ctx);
};

const buildPreviewResponse = async (evaluatedItems, selections, { cart, userId }) => {
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
  const offers = await computeStoreTotals(groups, selections, { cart, userId });
  const notes = mapToObject(cart.notes);

  let subtotal = 0;
  let shippingFee = 0;
  let grandTotal = 0;
  let discountTotal = 0;
  let feeTotal = 0;
  let tipTotal = 0;
  const byStore = [];
  for (const group of groups.values()) {
    const { store } = group;
    byStore.push({
      storeId: group.storeId,
      storeName: store?.name || "",
      storeSlug: store?.slug || "",
      location: store?.location || null,
      locationSet: store?.locationSet || false,
      deliveryRadiusKm: store?.deliveryRadiusKm || 5,
      itemCount: group.items.reduce((acc, x) => acc + x.item.quantity, 0),
      subtotal: group.subtotal,
      shippingFee: group.shippingFee,
      lines: group.priced.lines,
      discountTotal: group.priced.discountTotal,
      feeTotal: group.priced.feeTotal,
      tipAmount: group.priced.tipAmount,
      total: group.total,
      promotion: group.offers.promotion,
      optionalFees: group.offers.optionalFees,
      nearMisses: group.offers.nearMisses,
      minimumOrder: store?.minimumOrder || 0,
      fulfilment: group.fulfilment,
      note: notes[String(group.storeId)] || "",
      availableShippingMethods: (group.availableShippingMethods || []).map(
        buildMethodSnapshot
      ),
      selectedShippingMethod: buildMethodSnapshot(group.shippingMethod),
    });
    subtotal += group.subtotal;
    shippingFee += group.shippingFee;
    grandTotal += group.total;
    discountTotal += group.priced.discountTotal;
    feeTotal += group.priced.feeTotal;
    tipTotal += group.priced.tipAmount;
  }

  const blockingIssues = items.filter((x) => !x.available);
  const invalidCoupons = offers.coupons.filter((c) => c.status === "invalid");

  return {
    items,
    byStore,
    subtotal,
    shippingFee,
    discountTotal,
    feeTotal,
    tipTotal,
    grandTotal,
    coupons: offers.coupons,
    nearMisses: offers.nearMisses,
    blockingIssues: offers.blockingIssues,
    options: { allowSubstitutions: cart.allowSubstitutions !== false },
    canCheckout:
      blockingIssues.length === 0 &&
      offers.blockingIssues.length === 0 &&
      invalidCoupons.length === 0 &&
      byStore.length > 0,
    issues: [
      ...blockingIssues.map((x) => ({
        itemId: x._id,
        title: x.title,
        reason: x.reason,
      })),
      ...offers.blockingIssues.map((b) => ({ storeId: b.storeId, reason: b.message })),
      ...invalidCoupons.map((c) => ({ code: c.code, reason: `${c.code}: ${c.message}. Remove it to continue` })),
    ],
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
  const preview = await buildPreviewResponse(evaluatedItems, selections, {
    cart,
    userId: req.user.id,
  });
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
  customerNote = "",
  allowSubstitutions = true,
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
  ...orderPricingFields(storeGroup.priced),
  customerNote,
  allowSubstitutions,
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
  fulfilment: {
    method: storeGroup.fulfilment?.method || "delivery",
    asap: storeGroup.fulfilment?.asap !== false,
    slotStart: storeGroup.fulfilment?.slotStart || null,
    slotEnd: storeGroup.fulfilment?.slotEnd || null,
  },
});

// What the order keeps from the cart besides items: the note for that store
// (falling back to the checkout-wide note) and the substitution choice.
const orderDocsFor = ({ cart, storeGroups, user, shippingAddress, paymentMethod, notes }) => {
  const cartNotes = mapToObject(cart.notes);
  return Array.from(storeGroups.values()).map((group) => {
    const customerNote = (cartNotes[String(group.storeId)] || notes || "").toString().trim().slice(0, 500);
    return buildOrderDoc({
      storeGroup: group,
      user,
      shippingAddress,
      paymentMethod,
      notePrefix: customerNote ? `Order placed. Note: ${customerNote}` : "Order placed",
      customerNote,
      allowSubstitutions: cart.allowSubstitutions !== false,
    });
  });
};

// After placement the cart is empty and its one-off choices are spent.
// allowSubstitutions is a standing preference, so it stays.
const CLEARED_CART = { items: [], couponCodes: [], tips: {}, notes: {}, declinedFees: {}, fulfilment: {} };

const storesOf = (storeGroups) =>
  new Map(Array.from(storeGroups.values()).map((g) => [String(g.storeId), g.store]));

const placeOrdersWithTransaction = async ({
  cart,
  storeGroups,
  user,
  shippingAddress,
  paymentMethod,
  notes,
  checkoutId,
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

    const orderDocs = orderDocsFor({ cart, storeGroups, user, shippingAddress, paymentMethod, notes });

    // Mongoose refuses multi-document create() inside a session unless ordered
    const orders = await Order.create(orderDocs, { session, ordered: true });

    await claimCouponRedemptions({ orders, userId: user._id, checkoutId, session });
    await claimSlots({ orders, storesById: storesOf(storeGroups), session });

    await Cart.updateOne(
      { _id: cart._id },
      { $set: CLEARED_CART },
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
  checkoutId,
}) => {
  const decrementedItems = [];
  const createdOrderIds = [];
  let couponClaim = null;
  let slotClaim = null;

  try {
    for (const group of storeGroups.values()) {
      for (const { item } of group.items) {
        // eslint-disable-next-line no-await-in-loop
        await decrementStockForItem(item, null);
        decrementedItems.push(item);
      }
    }

    const orders = [];
    for (const doc of orderDocsFor({ cart, storeGroups, user, shippingAddress, paymentMethod, notes })) {
      // eslint-disable-next-line no-await-in-loop
      const order = await Order.create(doc);
      createdOrderIds.push(order._id);
      orders.push(order);
    }

    // Undoes its own partial claims if it throws
    couponClaim = await claimCouponRedemptions({ orders, userId: user._id, checkoutId });
    slotClaim = await claimSlots({ orders, storesById: storesOf(storeGroups) });

    await Cart.updateOne({ _id: cart._id }, { $set: CLEARED_CART });

    return orders;
  } catch (err) {
    if (slotClaim) await slotClaim.undo().catch(() => { });
    if (couponClaim) await couponClaim.undo().catch(() => { });
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
    // Checkout Sessions reject negative line items, so an order carrying any
    // price lines (discounts, fees, tips) is charged as one line for its total.
    if (Array.isArray(order.priceLines) && order.priceLines.length > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(Number(order.total)),
          product_data: { name: `Order ${order.orderNumber}` },
        },
      });
      continue;
    }
    for (const item of order.items) {
      lineItems.push({
        quantity: Number(item.quantity),
        price_data: {
          currency,
          unit_amount: Math.round(Number(item.unitPrice)),
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
          unit_amount: Math.round(Number(order.shippingFee)),
          product_data: {
            name: `Shipping (${order.orderNumber})`,
          },
        },
      });
    }
  }
  return lineItems;
};

const createStripeSessionForOrders = async ({ orders, user, transactionId, currency }) => {
  const stripe = getStripeClient();
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

const createStripePaymentIntentForOrders = async ({ orders, user, transactionId, currency }) => {
  const stripe = getStripeClient();
  const orderNumbers = orders.map((o) => o.orderNumber).join(",");
  const totalAmount = orders.reduce((acc, o) => acc + Number(o.total), 0);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount),
    currency,
    payment_method_types: ["card"],
    receipt_email: user.email,
    metadata: {
      transactionId: String(transactionId),
      userId: String(user._id),
      orderNumbers,
    },
  });

  return paymentIntent;
};

const placeOrder = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  // Collection-only baskets don't need a delivery address
  const collectionOnly =
    cart.items.length > 0 &&
    cart.items.every((i) => choiceFor(cart, i.store).method === "collection");
  validateCheckoutPayload(req.body, { addressRequired: !collectionOnly });

  // Admin can switch payment methods off platform-wide
  const { features = {} } = await PlatformSettings.getOrInit();
  if (req.body.paymentMethod === "cod" && features.codEnabled === false) {
    throw new ApiError(400, "Cash on delivery is currently unavailable");
  }
  if (req.body.paymentMethod === "online" && features.onlinePaymentEnabled === false) {
    throw new ApiError(400, "Card payments are currently unavailable");
  }

  if (req.body.paymentMethod === "online" && !isStripeConfigured()) {
    throw new ApiError(
      503,
      "Online payments are not configured on this server"
    );
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const shippingAddress =
    req.body.addressId || req.body.shippingAddress
      ? resolveShippingAddress(user, req.body)
      : { fullName: user.name, phone: user.phone || "" };

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

  // Price each store with the resolved methods (same function as the preview).
  const offers = await priceGroups(storeGroups, { cart, userId: user._id });

  const invalidCoupon = offers.coupons.find((c) => c.status === "invalid");
  if (invalidCoupon) {
    throw new ApiError(409, `${invalidCoupon.code}: ${invalidCoupon.message}. Remove it to continue`);
  }
  if (offers.blockingIssues.length > 0) {
    throw new ApiError(409, offers.blockingIssues[0].message);
  }
  const checkoutId = crypto.randomUUID();

  let orders;
  try {
    orders = await placeOrdersWithTransaction({
      cart,
      storeGroups,
      user,
      shippingAddress,
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes,
      checkoutId,
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
        checkoutId,
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
    if (req.body.paymentMethod === "cod") {
      onOrderPlacedToCustomer(order, user);
      // No await — onOrderPlacedToVendor schedules its own async dispatch
      onOrderPlacedToVendor(order, user);
    }
  }

  let paymentPayload = null;

  if (req.body.paymentMethod === "online") {
    const totalAmount = orders.reduce((acc, o) => acc + Number(o.total), 0);
    const currency = await getPlatformCurrency();

    const transaction = await PaymentTransaction.create({
      user: user._id,
      orders: orders.map((o) => o._id),
      provider: "stripe",
      status: "pending",
      amount: totalAmount,
      currency,
    });

    try {
      if (req.body.clientType === "mobile") {
        const paymentIntent = await createStripePaymentIntentForOrders({
          orders,
          user,
          transactionId: transaction._id,
          currency,
        });

        transaction.providerIntentId = paymentIntent.id;
        transaction.status = "processing";
        transaction.events.push({
          type: "stripe.payment_intent.created",
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
          clientSecret: paymentIntent.client_secret,
          amount: totalAmount,
          currency,
        };
      } else {
        const session = await createStripeSessionForOrders({
          orders,
          user,
          transactionId: transaction._id,
          currency,
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
          currency,
          expiresAt: session.expires_at
            ? new Date(session.expires_at * 1000)
            : null,
        };
      }
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

  const storeIds = [...new Set(orders.map((o) => o.store.toString()))];
  const stores = await require("../models/Store").find({ _id: { $in: storeIds } });
  const storeMap = new Map(stores.map(s => [s._id.toString(), s]));

  res.status(201).json({
    message: "Order placed",
    data: {
      orders: orders.map((o) => {
        const storeInfo = storeMap.get(o.store.toString());
        return {
          id: o._id,
          orderNumber: o.orderNumber,
          store: o.store,
          storeName: storeInfo?.name || "Store",
          storeContact: storeInfo?.contact?.phone || "",
          total: o.total,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
        };
      }),
      payment: paymentPayload,
    },
  });
});

module.exports = {
  previewCheckout,
  placeOrder,
};
