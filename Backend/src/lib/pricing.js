/**
 * pricing.js — the one place a store group's money is computed.
 *
 * A cart is split into one group per store (one Order per store at checkout).
 * Cart summary, checkout preview and order placement all price a group by
 * calling priceStoreGroup(); nothing else adds money up.
 *
 * ── Units (settled in Wave 0, verified against the code at 181a9c6) ─────────
 *   Integer PENCE (GBP minor units):
 *     Product.price / compareAtPrice, variant prices, Cart item unitPrice,
 *     Order subtotal / shippingFee / total / items[].unitPrice / items[].total,
 *     Order.priceLines[].amount, discountTotal, feeTotal, tipAmount,
 *     PaymentTransaction.amount, commission fixed fees.
 *   POUNDS (as typed by vendors in the portal) — converted with
 *   lib/money.poundsToPence, which also rounds away float noise:
 *     ShippingMethod.fee, StoreSettings.shipping.flatFee / freeShippingThreshold,
 *     and the Order.shippingMethod.fee snapshot (kept in pounds for now).
 *   Stripe takes minor units, so pence are passed straight through.
 *   Commission.amount is pence but may be fractional (rate × base, 2 dp) —
 *   historical behaviour, left as is.
 *
 * ── Price lines ─────────────────────────────────────────────────────────────
 *   Adjustments come in with a POSITIVE `amount` (a magnitude). Lines come out
 *   SIGNED, so total = subtotal + shippingFee + Σ lines.amount:
 *     discount | coupon | loyalty   -> negative (reduce what the customer pays)
 *     fee | tip                     -> positive
 *   fundedBy says whose books the line lands on:
 *     on a reduction, the party that absorbs the cost;
 *     on a fee, the party that keeps it.  Tips always go to the store.
 *   Reductions are applied in order and capped so the goods + delivery part of
 *   the bill never goes below zero; a reduction capped to 0 is dropped.
 *   The client never sends these amounts — callers build adjustments from
 *   server-side rules (coupons, loyalty, fee settings) only.
 *
 * Wave 0 passes no adjustments, so every total equals subtotal + shippingFee,
 * exactly as before the refactor.
 */
const ApiError = require("./ApiError");
const { computeShippingFeeForStore } = require("./shippingUtils");
const { computeCommissionBase } = require("./commissionUtils");

const LINE_KINDS = ["discount", "coupon", "loyalty", "fee", "tip"];
const REDUCING_KINDS = new Set(["discount", "coupon", "loyalty"]);
const FUNDERS = ["platform", "vendor"];

const assertAdjustment = (adj) => {
  if (!adj || !LINE_KINDS.includes(adj.kind)) {
    throw new ApiError(500, `Unknown price line kind: ${adj && adj.kind}`);
  }
  if (!Number.isInteger(adj.amount) || adj.amount < 0) {
    throw new ApiError(500, `Price line amount must be non-negative integer pence (${adj.kind})`);
  }
  const fundedBy = adj.kind === "tip" ? "vendor" : adj.fundedBy;
  if (!FUNDERS.includes(fundedBy)) {
    throw new ApiError(500, `Price line ${adj.kind} needs fundedBy platform|vendor`);
  }
  return fundedBy;
};

const sumItems = (items) => {
  let subtotal = 0;
  for (const { unitPrice, quantity } of items) {
    const price = Number(unitPrice);
    const qty = Number(quantity);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty < 0) {
      throw new ApiError(500, "Invalid item price or quantity");
    }
    subtotal += price * qty;
  }
  return subtotal;
};

/**
 * @param {object}   p
 * @param {Array<{unitPrice:number, quantity:number}>} p.items  unitPrice in pence
 * @param {object}  [p.store]           Store doc (reserved: minimum order, opt-ins)
 * @param {object}  [p.settings]        StoreSettings doc (shipping config, pounds)
 * @param {object}  [p.shippingMethod]  ShippingMethod doc or null
 * @param {string}  [p.fulfilmentMethod] "delivery" (default) | "collection"
 * @param {Array}   [p.adjustments]     [{ kind, code, ref, label, info, amount, fundedBy, removable }]
 *                                      ref: id of the Coupon / Promotion behind the line
 * @returns {{ subtotal, shippingFee, lines, discountTotal, feeTotal, tipAmount, total, commissionBase }}
 */
// eslint-disable-next-line no-unused-vars
const priceStoreGroup = ({
  items,
  store = null,
  settings = null,
  shippingMethod = null,
  adjustments = [],
  fulfilmentMethod = "delivery",
}) => {
  const subtotal = sumItems(items || []);
  // Collected orders are never charged for delivery
  const shippingFee =
    fulfilmentMethod === "collection"
      ? 0
      : computeShippingFeeForStore({ method: shippingMethod, settings, subtotal });

  let reducible = subtotal + shippingFee;
  const lines = [];
  for (const adj of adjustments || []) {
    const fundedBy = assertAdjustment(adj);
    let amount = adj.amount;
    if (REDUCING_KINDS.has(adj.kind)) {
      amount = Math.min(amount, Math.max(0, Math.floor(reducible)));
      reducible -= amount;
      amount = -amount;
    }
    if (amount === 0) continue;
    lines.push({
      kind: adj.kind,
      code: adj.code || "",
      ref: adj.ref ? String(adj.ref) : "",
      label: adj.label || "",
      info: adj.info || "",
      amount,
      fundedBy,
      removable: Boolean(adj.removable),
    });
  }

  let discountTotal = 0;
  let feeTotal = 0;
  let tipAmount = 0;
  for (const line of lines) {
    if (REDUCING_KINDS.has(line.kind)) discountTotal -= line.amount;
    else if (line.kind === "tip") tipAmount += line.amount;
    else feeTotal += line.amount;
  }

  const total = subtotal + shippingFee - discountTotal + feeTotal + tipAmount;

  return {
    subtotal,
    shippingFee,
    lines,
    discountTotal,
    feeTotal,
    tipAmount,
    total,
    commissionBase: computeCommissionBase({ subtotal, shippingFee, lines }),
  };
};

/** The pricing fields an Order stores, from a priceStoreGroup() result. */
const orderPricingFields = (priced) => ({
  subtotal: priced.subtotal,
  shippingFee: priced.shippingFee,
  priceLines: priced.lines,
  discountTotal: priced.discountTotal,
  feeTotal: priced.feeTotal,
  tipAmount: priced.tipAmount,
  total: priced.total,
});

module.exports = {
  priceStoreGroup,
  orderPricingFields,
  LINE_KINDS,
  REDUCING_KINDS,
  FUNDERS,
};
