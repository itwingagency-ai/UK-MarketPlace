/**
 * Changing what's in an order after it was placed:
 *   unavailable  the store can't supply a line (whole line, or some of it)
 *   substitute   the store swaps a line for another product (only if the
 *                customer allowed substitutions; never at a higher price)
 *   refused      an age-restricted line refused on handover (no valid ID)
 *
 * Every change re-prices the order from its own stored price lines (no new
 * coupons or fees are worked out), then gives the difference back:
 * a partial Stripe refund for card orders, or less cash to collect for COD.
 * Stock follows the goods. The store funds these refunds: commission is
 * recalculated on the smaller order.
 */
const ApiError = require("./ApiError");
const Order = require("../models/Order");
const Product = require("../models/Product");
const PlatformSettings = require("../models/PlatformSettings");
const Store = require("../models/Store");
const { buildOrderCommissionSnapshot, resolveCommissionConfig } = require("./commissionUtils");
const { getStripeClient, isStripeConfigured } = require("./stripeClient");
const loyalty = require("./loyalty");

const REDUCING = new Set(["discount", "coupon", "loyalty"]);
const CHARGED = (item) => item.lineStatus === "ok" || item.lineStatus === "substituted";

/**
 * Recompute subtotal, line amounts and total from the order's items and its
 * existing price lines. Reductions keep their original size unless the goods
 * left are smaller (then they shrink, in order). Fees, tips and delivery stay.
 * Returns how much smaller the loyalty line got (pence), so points can go back.
 */
const repriceOrder = (order) => {
  const subtotal = order.items.filter(CHARGED).reduce((a, i) => a + Number(i.total), 0);
  let reducible = subtotal + Number(order.shippingFee || 0);
  let discountTotal = 0;
  let feeTotal = 0;
  let tipAmount = 0;
  let loyaltyShrink = 0;
  for (const line of order.priceLines) {
    if (REDUCING.has(line.kind)) {
      const wanted = -Number(line.amount);
      const allowed = Math.min(wanted, Math.max(0, reducible));
      if (line.kind === "loyalty") loyaltyShrink += wanted - allowed;
      line.amount = -allowed;
      reducible -= allowed;
      discountTotal += allowed;
    } else if (line.kind === "tip") {
      tipAmount += Number(line.amount);
    } else {
      feeTotal += Number(line.amount);
    }
  }
  order.subtotal = subtotal;
  order.discountTotal = discountTotal;
  order.feeTotal = feeTotal;
  order.tipAmount = tipAmount;
  order.total = subtotal + Number(order.shippingFee || 0) - discountTotal + feeTotal + tipAmount;
  return { loyaltyShrink };
};

const restoreStock = (item, qty) =>
  item.variantId
    ? Product.updateOne({ _id: item.product, "variants._id": item.variantId }, { $inc: { "variants.$.stock": qty } })
    : Product.updateOne({ _id: item.product }, { $inc: { stock: qty } });

const takeStock = async ({ productId, variantId, qty }) => {
  const filter = variantId
    ? { _id: productId, isActive: true, variants: { $elemMatch: { _id: variantId, isActive: true, stock: { $gte: qty } } } }
    : { _id: productId, isActive: true, stock: { $gte: qty } };
  const update = variantId ? { $inc: { "variants.$.stock": -qty } } : { $inc: { stock: -qty } };
  const res = await Product.updateOne(filter, update);
  if (res.modifiedCount === 0) throw new ApiError(409, "Not enough stock of the substitute");
};

/**
 * Give money back for an order that got smaller. Card: partial Stripe refund
 * (idempotent per adjustment). COD: nothing to refund, the customer pays the
 * new, lower total at the door. Never throws; a failed refund is recorded.
 */
const refundDifference = async (order, amount, { reason, by }) => {
  if (amount <= 0) return null;
  if (order.paymentMethod !== "online" || order.paymentStatus !== "paid") {
    order.refunds.push({ amount, reason, provider: "cod", status: "not_charged", by });
    return { refunded: false, reason: "not_charged" };
  }
  // eslint-disable-next-line global-require
  const PaymentTransaction = require("../models/PaymentTransaction");
  const tx = await PaymentTransaction.findOne({ orders: order._id, provider: "stripe", status: { $in: ["succeeded", "refunded"] } });
  if (!tx?.providerIntentId || !isStripeConfigured()) {
    order.refunds.push({ amount, reason: `${reason} (refund needs doing by hand)`, provider: "stripe", status: "failed", by });
    return { refunded: false, reason: "no_payment_found" };
  }
  try {
    const refund = await getStripeClient().refunds.create(
      {
        payment_intent: tx.providerIntentId,
        amount,
        metadata: { orderId: String(order._id), orderNumber: order.orderNumber || "", reason },
      },
      { idempotencyKey: `partial-${order._id}-${order.refunds.length}` }
    );
    order.refunds.push({ amount, reason, provider: "stripe", providerRef: refund.id, status: "succeeded", by });
    return { refunded: true };
  } catch (err) {
    order.refunds.push({ amount, reason: `${reason} (Stripe: ${err.message})`, provider: "stripe", status: "failed", by });
    return { refunded: false, reason: err.message };
  }
};

const EDITABLE = {
  unavailable: ["pending", "confirmed", "packed", "ready_for_collection"],
  substitute: ["pending", "confirmed", "packed"],
  refused: ["shipped", "ready_for_collection"],
};

/**
 * @param {object} order       Order document
 * @param {number} index       index into order.items
 * @param {object} change      { action, quantity?, productId?, variantId? }
 *   unavailable: quantity = how many can't be supplied (default: all)
 *   substitute:  productId (+variantId) from the same store
 *   refused:     whole line (age-restricted only)
 * @param {{id, role}} actor
 * @returns {Promise<{ order, refund, refundAmount }>}
 */
const adjustOrderItem = async (order, index, change, actor) => {
  const item = order.items[index];
  if (!item) throw new ApiError(404, "That item isn't on this order");
  const allowed = EDITABLE[change.action];
  if (!allowed) throw new ApiError(400, "action must be unavailable, substitute or refused");
  if (!allowed.includes(order.orderStatus)) {
    throw new ApiError(409, `Items can't be ${change.action === "substitute" ? "substituted" : "changed"} once an order is ${order.orderStatus}`);
  }
  if (!CHARGED(item)) throw new ApiError(409, "That item has already been changed");

  const before = Number(order.total);
  let note;

  if (change.action === "unavailable") {
    const qty = change.quantity === undefined ? item.quantity : Number(change.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > item.quantity) {
      throw new ApiError(400, `quantity must be from 1 to ${item.quantity}`);
    }
    await restoreStock(item, qty);
    if (item.originalQuantity == null) item.originalQuantity = item.quantity;
    if (qty === item.quantity) {
      item.lineStatus = "unavailable";
      item.total = 0;
    } else {
      item.quantity -= qty;
      item.total = item.quantity * Number(item.unitPrice);
    }
    note = `${qty} × ${item.title} unavailable`;
  } else if (change.action === "refused") {
    if (!item.minAge) throw new ApiError(400, "Only age-restricted items can be refused at handover");
    await restoreStock(item, item.quantity);
    item.lineStatus = "refused";
    item.total = 0;
    note = `${item.title} not handed over (no valid ID)`;
  } else {
    if (order.allowSubstitutions === false) throw new ApiError(409, "The customer asked for no substitutions");
    const product = await Product.findOne({ _id: change.productId, store: order.store, isActive: true });
    if (!product) throw new ApiError(404, "Substitute product not found in this store");
    let variant = null;
    if (product.variants?.length) {
      variant = product.variants.id(change.variantId);
      if (!variant || !variant.isActive) throw new ApiError(400, "Pick a size of the substitute");
    }
    if (String(product._id) === String(item.product) && String(variant?._id || "") === String(item.variantId || "")) {
      throw new ApiError(400, "That's the same item");
    }
    const listPrice = Number(variant ? variant.price : product.price);
    await takeStock({ productId: product._id, variantId: variant?._id, qty: item.quantity });
    await restoreStock(item, item.quantity);
    const was = item.title;
    // The customer never pays more for a substitute
    const unitPrice = Math.min(listPrice, Number(item.unitPrice));
    item.product = product._id;
    item.variantId = variant?._id || null;
    item.title = product.title;
    item.sku = variant?.sku || "";
    item.attributes = variant?.attributes || new Map();
    item.minAge = product.minAge || 0;
    item.unitPrice = unitPrice;
    item.total = unitPrice * item.quantity;
    item.substitutedFor = was;
    item.lineStatus = "substituted";
    note = `${was} swapped for ${product.title}`;
  }

  const { loyaltyShrink } = repriceOrder(order);
  order.ageCheck = Math.max(0, ...order.items.filter(CHARGED).map((i) => i.minAge || 0));
  const refundAmount = Math.max(0, before - Number(order.total));

  // The store funds unavailable items: commission follows the smaller order
  if (order.commission?.calculatedAt) {
    const [store, platform] = await Promise.all([
      Store.findById(order.store).select("commissionType commissionRate commissionFixed"),
      PlatformSettings.getOrInit(),
    ]);
    order.commission = buildOrderCommissionSnapshot(resolveCommissionConfig(store, platform), order);
  }

  const refund = await refundDifference(order, refundAmount, { reason: note, by: actor.id });
  order.statusHistory.push({
    status: order.orderStatus,
    changedBy: actor.id,
    changedByRole: actor.role,
    changedAt: new Date(),
    note: refundAmount > 0 ? `${note}; £${(refundAmount / 100).toFixed(2)} back to the customer` : note,
  });
  await order.save();

  // Points that no longer fit the smaller order go back to the customer
  if (loyaltyShrink > 0) {
    const cfg = loyalty.loyaltyConfig(await PlatformSettings.getOrInit());
    const points = Math.floor(loyaltyShrink / cfg.pointValuePence);
    if (points > 0) {
      await loyalty.postEntry({
        user: order.customer,
        type: "restore",
        points,
        key: `restore-partial:${order._id}:${order.refunds.length}:${index}`,
        order: order._id,
        note: `Returned: ${order.orderNumber} got smaller`,
        expiresAt: loyalty.addMonths(new Date(), cfg.expiryMonths),
      });
      order.loyalty.pointsRedeemed = Math.max(0, (order.loyalty.pointsRedeemed || 0) - points);
      await Order.updateOne({ _id: order._id }, { $set: { "loyalty.pointsRedeemed": order.loyalty.pointsRedeemed } });
    }
  }

  return { order, refund, refundAmount, note };
};

module.exports = { adjustOrderItem, repriceOrder, refundDifference, CHARGED };
