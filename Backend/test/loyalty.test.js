/**
 * Pure tests: spending points in lib/offers.priceCart, and earning maths.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

require("./helpers/harness");
const { priceCart } = require("../src/lib/offers");
const { pointsForSpend, goodsPaid, DEFAULTS } = require("../src/lib/loyalty");
const { commissionBaseForOrder } = require("../src/lib/commissionUtils");

const id = () => new mongoose.Types.ObjectId();
const cfg = { ...DEFAULTS, enabled: true }; // 1 pt per £1, 100 pts = £1, min 100

const groups = () => [
  { storeId: id(), store: { loyaltyOptIn: true }, settings: null, shippingMethod: { fee: 2.5 }, items: [{ product: id(), unitPrice: 1800, quantity: 1 }] },
  { storeId: id(), store: { loyaltyOptIn: true }, settings: null, shippingMethod: null, items: [{ product: id(), unitPrice: 600, quantity: 1 }] },
  { storeId: id(), store: { loyaltyOptIn: false }, settings: null, shippingMethod: null, items: [{ product: id(), unitPrice: 999, quantity: 1 }] },
];
const run = (loyalty, over = {}) => priceCart({ groups: groups(), loyalty: { cfg, ...loyalty }, ...over });
const pointLines = (r) => r.groups.map((g) => g.priced.lines.filter((l) => l.kind === "loyalty").reduce((a, l) => a - l.amount, 0));

describe("spending points", () => {
  it("is off unless switched on", () => {
    const r = priceCart({ groups: groups(), loyalty: { cfg: DEFAULTS, balance: 1000, requestedPoints: 500 } });
    assert.equal(r.loyalty.enabled, false);
    assert.deepEqual(pointLines(r), [0, 0, 0]);
  });

  it("spreads points over taking-part stores only, platform-funded", () => {
    const r = run({ balance: 1000, requestedPoints: 400 });
    assert.equal(r.loyalty.appliedPoints, 400);
    assert.equal(r.loyalty.value, 400);
    assert.deepEqual(pointLines(r), [300, 100, 0]); // 1800:600 split
    assert.deepEqual(r.groups.map((g) => g.loyaltyPoints), [300, 100, 0]);
    const line = r.groups[0].priced.lines.find((l) => l.kind === "loyalty");
    assert.equal(line.fundedBy, "platform");
    assert.equal(line.label, "300 points");
    const g = r.groups[0].priced;
    assert.equal(commissionBaseForOrder({ subtotal: g.subtotal, shippingFee: g.shippingFee, priceLines: g.lines }), 1800 + 250, "the store's commission base is untouched");
  });

  it("caps at balance, the per-checkout maximum, and the goods at taking-part stores", () => {
    assert.equal(run({ balance: 250, requestedPoints: 400 }).loyalty.appliedPoints, 250);
    const capped = run({ balance: 1000, requestedPoints: 900 }, {});
    assert.equal(capped.loyalty.maxPoints, 1000, "balance is the tighter cap here");
    const perCheckout = priceCart({ groups: groups(), loyalty: { cfg: { ...cfg, maxRedeemPoints: 300 }, balance: 1000, requestedPoints: 900 } });
    assert.equal(perCheckout.loyalty.appliedPoints, 300);
    assert.match(perCheckout.loyalty.message, /Using 300 points/);
    const goods = run({ balance: 99999, requestedPoints: 99999 });
    assert.equal(goods.loyalty.appliedPoints, 2400, "never more than the £24 of goods at taking-part stores");
    assert.equal(goods.groups[0].priced.total, 250, "delivery is still paid");
  });

  it("applies points after coupons, on what goods are left", () => {
    const coupon = { _id: id(), code: "TEN", scope: "platform", type: "fixed", value: 1000, minSubtotal: 0, perUserLimit: 1, fundedBy: "platform", isActive: true, redemptionCount: 0 };
    const r = run({ balance: 99999, requestedPoints: 99999 }, { couponCodes: ["TEN"], coupons: [coupon] });
    const left = r.groups.slice(0, 2).reduce((a, g) => a + g.priced.subtotal + g.priced.lines.filter((l) => l.kind === "coupon").reduce((x, l) => x + l.amount, 0), 0);
    assert.equal(r.loyalty.appliedPoints, left);
  });

  it("respects the minimum points and minimum basket", () => {
    const few = run({ balance: 60, requestedPoints: 60 });
    assert.equal(few.loyalty.appliedPoints, 0);
    assert.match(few.loyalty.message, /once you have 100/);
    const small = run({ balance: 1000, requestedPoints: 50 });
    assert.equal(small.loyalty.appliedPoints, 0);
    assert.match(small.loyalty.message, /at least 100/);
    const basket = priceCart({ groups: groups(), loyalty: { cfg: { ...cfg, minBasketToRedeem: 5000 }, balance: 1000, requestedPoints: 200 } });
    assert.equal(basket.loyalty.appliedPoints, 0);
    assert.match(basket.loyalty.message, /Spend £50\.00/);
  });

  it("estimates points earned on goods actually paid for, at taking-part stores", () => {
    assert.equal(run({ balance: 0, requestedPoints: 0 }).loyalty.earnEstimate, 18 + 6);
    assert.equal(run({ balance: 1000, requestedPoints: 400 }).loyalty.earnEstimate, 15 + 5);
  });
});

describe("earning maths", () => {
  it("1 point per whole pound of goods paid for", () => {
    assert.equal(pointsForSpend(1999, cfg), 19);
    assert.equal(pointsForSpend(-50, cfg), 0);
    assert.equal(pointsForSpend(1000, { ...cfg, earnPointsPerPound: 2 }), 20);
    assert.equal(goodsPaid({ subtotal: 2000, discountTotal: 450 }), 1550);
    assert.equal(goodsPaid({ subtotal: 500, discountTotal: 900 }), 0);
  });
});
