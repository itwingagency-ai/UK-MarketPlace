/**
 * Pure test: re-pricing an order that got smaller, from its own price lines.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("./helpers/harness");
const { repriceOrder } = require("../src/lib/orderAdjustments");

const order = () => ({
  shippingFee: 250,
  items: [
    { title: "A", unitPrice: 1000, quantity: 1, total: 1000, lineStatus: "ok" },
    { title: "B", unitPrice: 500, quantity: 2, total: 1000, lineStatus: "ok" },
  ],
  priceLines: [
    { kind: "coupon", amount: -500, fundedBy: "platform" },
    { kind: "loyalty", amount: -800, fundedBy: "platform" },
    { kind: "fee", amount: 50, fundedBy: "platform" },
    { kind: "tip", amount: 100, fundedBy: "vendor" },
  ],
});

describe("repriceOrder", () => {
  it("keeps every line when the goods still cover them", () => {
    const o = order();
    o.items[1].lineStatus = "unavailable";
    o.items[1].total = 0;
    const { loyaltyShrink } = repriceOrder(o);
    assert.equal(o.subtotal, 1000);
    assert.deepEqual(o.priceLines.map((l) => l.amount), [-500, -750, 50, 100]);
    assert.equal(loyaltyShrink, 50, "points worth 50p no longer fit");
    assert.equal(o.total, 1000 + 250 - 1250 + 50 + 100);
  });

  it("shrinks reductions in order and never lets goods + delivery go negative", () => {
    const o = order();
    o.items[0].lineStatus = "refused";
    o.items[0].total = 0;
    o.items[1].quantity = 1;
    o.items[1].total = 500;
    const { loyaltyShrink } = repriceOrder(o);
    assert.deepEqual(o.priceLines.map((l) => l.amount), [-500, -250, 50, 100]);
    assert.equal(loyaltyShrink, 550);
    assert.equal(o.total, 150, "only the fee and the tip are still charged");
    assert.equal(o.discountTotal, 750);
  });
});
