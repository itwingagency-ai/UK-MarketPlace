const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// pricing.js pulls in models via shippingUtils; env.js needs these to load.
require("./helpers/harness");
const { priceStoreGroup } = require("../src/lib/pricing");
const { poundsToPence } = require("../src/lib/money");
const {
  computeCommissionBase,
  commissionBaseForOrder,
  buildCommissionSnapshot,
} = require("../src/lib/commissionUtils");

const items = [
  { unitPrice: 450, quantity: 2 },
  { unitPrice: 899, quantity: 1 },
];
const standard = { fee: 2.5 };
const settings = { shipping: { flatFee: 1, freeShippingThreshold: 30 } };

describe("poundsToPence", () => {
  it("rounds away float noise", () => {
    assert.equal(2.49 * 100, 249.00000000000003);
    assert.equal(poundsToPence(2.49), 249);
    assert.equal(poundsToPence(1.15), 115);
    assert.equal(poundsToPence(null), 0);
    assert.equal(poundsToPence("x"), 0);
  });
});

describe("priceStoreGroup", () => {
  it("without adjustments: total = subtotal + shipping, no lines", () => {
    const p = priceStoreGroup({ items, settings, shippingMethod: standard });
    assert.deepEqual(p, {
      subtotal: 1799,
      shippingFee: 250,
      lines: [],
      discountTotal: 0,
      feeTotal: 0,
      tipAmount: 0,
      total: 2049,
      commissionBase: 2049,
    });
  });

  it("falls back to the settings flat fee, then to free", () => {
    assert.equal(priceStoreGroup({ items, settings }).shippingFee, 100);
    assert.equal(priceStoreGroup({ items }).shippingFee, 0);
  });

  it("free-shipping threshold is compared in whole pence", () => {
    // 1.15 * 100 === 114.99999999999999: a 115p basket now qualifies
    const s = { shipping: { freeShippingThreshold: 1.15 } };
    const p = priceStoreGroup({ items: [{ unitPrice: 115, quantity: 1 }], settings: s, shippingMethod: { fee: 1.15 } });
    assert.equal(p.shippingFee, 0);
    const q = priceStoreGroup({ items: [{ unitPrice: 100, quantity: 1 }], shippingMethod: { fee: 2.49 } });
    assert.equal(q.shippingFee, 249);
    assert.equal(q.total, 349);
  });

  it("signs lines and totals every kind", () => {
    const p = priceStoreGroup({
      items,
      settings,
      shippingMethod: standard,
      adjustments: [
        { kind: "coupon", code: "SAVE2", label: "£2 off", amount: 200, fundedBy: "vendor" },
        { kind: "discount", label: "Platform promo", amount: 100, fundedBy: "platform" },
        { kind: "fee", code: "service", label: "Service fee", amount: 49, fundedBy: "platform" },
        { kind: "tip", label: "Tip", amount: 150 },
      ],
    });
    assert.deepEqual(p.lines.map((l) => [l.kind, l.amount, l.fundedBy]), [
      ["coupon", -200, "vendor"],
      ["discount", -100, "platform"],
      ["fee", 49, "platform"],
      ["tip", 150, "vendor"],
    ]);
    assert.equal(p.discountTotal, 300);
    assert.equal(p.feeTotal, 49);
    assert.equal(p.tipAmount, 150);
    assert.equal(p.total, 1799 + 250 - 300 + 49 + 150);
    assert.equal(p.total, p.subtotal + p.shippingFee + p.lines.reduce((a, l) => a + l.amount, 0));
    // vendor coupon reduces the base; platform discount, platform fee and tip do not
    assert.equal(p.commissionBase, 1799 + 250 - 200);
  });

  it("caps reductions so goods + delivery never go below zero", () => {
    const p = priceStoreGroup({
      items: [{ unitPrice: 300, quantity: 1 }],
      adjustments: [
        { kind: "coupon", amount: 250, fundedBy: "platform" },
        { kind: "loyalty", amount: 500, fundedBy: "platform" },
        { kind: "discount", amount: 100, fundedBy: "vendor" },
        { kind: "tip", amount: 100 },
      ],
    });
    assert.deepEqual(p.lines.map((l) => [l.kind, l.amount]), [["coupon", -250], ["loyalty", -50], ["tip", 100]]);
    assert.equal(p.total, 100);
  });

  it("rejects malformed adjustments", () => {
    const bad = [
      { kind: "cashback", amount: 1, fundedBy: "platform" },
      { kind: "coupon", amount: -5, fundedBy: "platform" },
      { kind: "coupon", amount: 1.5, fundedBy: "platform" },
      { kind: "fee", amount: 10 },
    ];
    for (const adj of bad) {
      assert.throws(() => priceStoreGroup({ items, adjustments: [adj] }), /Price line|Unknown/);
    }
  });
});

describe("commission base", () => {
  it("legacy orders (no price lines) are charged on subtotal + shipping = total", () => {
    const order = { subtotal: 1799, shippingFee: 250, total: 2049 };
    assert.equal(commissionBaseForOrder(order), 2049);
    const snap = buildCommissionSnapshot({ type: "percentage", rate: 0.1, fixed: 0, source: "platform" }, 2049);
    assert.equal(snap.amount, 204.9);
    assert.equal(snap.base, 2049);
  });

  it("platform-funded lines do not touch vendor payout; vendor-funded do", () => {
    const base = (lines) => computeCommissionBase({ subtotal: 1000, shippingFee: 200, lines });
    assert.equal(base([{ kind: "coupon", amount: -300, fundedBy: "platform" }]), 1200);
    assert.equal(base([{ kind: "coupon", amount: -300, fundedBy: "vendor" }]), 900);
    assert.equal(base([{ kind: "fee", amount: 50, fundedBy: "platform" }]), 1200);
    assert.equal(base([{ kind: "fee", amount: 50, fundedBy: "vendor" }]), 1250);
    assert.equal(base([{ kind: "tip", amount: 200, fundedBy: "vendor" }]), 1200);
  });
});
