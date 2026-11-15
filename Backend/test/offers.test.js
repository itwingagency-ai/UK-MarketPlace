/**
 * Pure tests for lib/offers.priceCart: stacking, limits, eligibility,
 * promotions, fees, tips, near misses. No database.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

require("./helpers/harness"); // env vars so lib modules load
const { priceCart, allocate, couponBlocker, evaluatePromotion } = require("../src/lib/offers");
const { commissionBaseForOrder } = require("../src/lib/commissionUtils");

const id = () => new mongoose.Types.ObjectId();
const A = id();
const B = id();
const C = id();
const P1 = id();
const P2 = id();
const P3 = id();
const CAT = id();

// A: 1799 goods, £2.50 delivery, free over £30 · B: 750 goods, £3.50 flat · C: 199, free
const groups = () => [
  {
    storeId: A,
    store: { name: "Alpha", minimumOrder: 0 },
    settings: { shipping: { flatFee: 1, freeShippingThreshold: 30 } },
    shippingMethod: { fee: 2.5 },
    items: [
      { product: P1, category: CAT, unitPrice: 450, quantity: 2 },
      { product: P2, category: null, unitPrice: 899, quantity: 1 },
    ],
  },
  {
    storeId: B,
    store: { name: "Bravo" },
    settings: { shipping: { flatFee: 3.5 } },
    shippingMethod: null,
    items: [{ product: P3, unitPrice: 250, quantity: 3 }],
  },
  { storeId: C, store: { name: "Charlie" }, settings: null, shippingMethod: null, items: [{ product: id(), unitPrice: 199, quantity: 1 }] },
];

const coupon = (over = {}) => ({
  _id: id(),
  code: "SAVE",
  scope: "platform",
  store: null,
  type: "fixed",
  value: 500,
  maxDiscount: null,
  minSubtotal: 0,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perUserLimit: 1,
  firstOrderOnly: false,
  fundedBy: "platform",
  isActive: true,
  redemptionCount: 0,
  ...over,
});

const run = (over = {}) => priceCart({ groups: groups(), ...over });
const lines = (g, kind) => g.priced.lines.filter((l) => !kind || l.kind === kind);
const total = (r) => r.groups.reduce((a, g) => a + g.priced.total, 0);

describe("allocate", () => {
  it("splits exactly, in proportion, largest remainder first", () => {
    assert.deepEqual(allocate(500, [1799, 750, 199]), [327, 137, 36]);
    assert.equal(allocate(500, [1799, 750, 199]).reduce((a, b) => a + b), 500);
    assert.deepEqual(allocate(10, [0, 0]), [0, 0]);
    assert.deepEqual(allocate(1, [1, 1, 1]), [1, 0, 0]);
  });
});

describe("no offers: identical to Wave 0", () => {
  it("totals are subtotal + delivery", () => {
    const r = run();
    assert.deepEqual(r.groups.map((g) => g.priced.total), [2049, 1100, 199]);
    assert.equal(r.groups.every((g) => g.priced.lines.length === 0), true);
  });
});

describe("coupons", () => {
  it("platform fixed coupon is spread across store orders and adds up exactly", () => {
    const c = coupon();
    const r = run({ couponCodes: ["SAVE"], coupons: [c] });
    assert.deepEqual(r.groups.map((g) => -lines(g, "coupon")[0].amount), [327, 137, 36]);
    assert.equal(r.coupons[0].status, "applied");
    assert.equal(r.coupons[0].discount, 500);
    assert.equal(total(r), 3348 - 500);
    assert.ok(r.groups.every((g) => lines(g, "coupon")[0].fundedBy === "platform"));
    assert.ok(r.groups.every((g) => g.appliedCoupons[0].couponId === String(c._id)));
  });

  it("a fixed coupon never exceeds the goods", () => {
    const r = run({ couponCodes: ["SAVE"], coupons: [coupon({ value: 999999 })] });
    assert.equal(r.coupons[0].discount, 1799 + 750 + 199);
    // delivery is still charged
    assert.equal(total(r), 250 + 350);
  });

  it("percent coupon with a cap spreads the cap", () => {
    const r = run({ couponCodes: ["SAVE"], coupons: [coupon({ type: "percent", value: 50, maxDiscount: 300 })] });
    assert.equal(r.coupons[0].discount, 300);
  });

  it("free delivery removes every store's delivery charge", () => {
    const r = run({ couponCodes: ["SAVE"], coupons: [coupon({ type: "free_delivery", value: 0 })] });
    assert.deepEqual(r.groups.map((g) => g.priced.total), [1799, 750, 199]);
    assert.equal(lines(r.groups[2], "coupon").length, 0, "no line where delivery was already free");
  });

  it("store coupon and platform coupon stack, store first, on goods left", () => {
    const store = coupon({ code: "ALPHA10", scope: "store", store: A, type: "percent", value: 10, fundedBy: "vendor" });
    const plat = coupon({ type: "percent", value: 10 });
    const r = run({ couponCodes: ["SAVE", "ALPHA10"], coupons: [store, plat] });
    const a = r.groups[0];
    assert.deepEqual(lines(a, "coupon").map((l) => [l.code, l.amount, l.fundedBy]), [
      ["ALPHA10", -180, "vendor"],
      ["SAVE", -162, "platform"], // 10% of 1799 - 180
    ]);
    // vendor coupon reduces the commission base; the platform one doesn't
    const order = { subtotal: a.priced.subtotal, shippingFee: a.priced.shippingFee, priceLines: a.priced.lines };
    assert.equal(commissionBaseForOrder(order), 2049 - 180);
  });

  it("only one platform code and one code per store", () => {
    const r = run({
      couponCodes: ["SAVE", "MORE", "A1", "A2"],
      coupons: [
        coupon(),
        coupon({ code: "MORE" }),
        coupon({ code: "A1", scope: "store", store: A, fundedBy: "vendor" }),
        coupon({ code: "A2", scope: "store", store: A, fundedBy: "vendor" }),
      ],
    });
    assert.deepEqual(r.coupons.map((c) => c.status), ["applied", "invalid", "applied", "invalid"]);
  });

  it("minimum spend keeps the code pending with a nudge", () => {
    const r = run({ couponCodes: ["SAVE"], coupons: [coupon({ minSubtotal: 3000 })] });
    assert.equal(r.coupons[0].status, "pending");
    assert.equal(total(r), 3348);
    const n = r.nearMisses.find((x) => x.kind === "coupon");
    assert.equal(n.amountNeeded, 3000 - 2748);
    assert.match(n.message, /£2\.52 more to use SAVE/);
  });

  it("a store coupon for a store not in the basket is pending", () => {
    const r = run({ couponCodes: ["ELSE"], coupons: [coupon({ code: "ELSE", scope: "store", store: id(), fundedBy: "vendor" })] });
    assert.equal(r.coupons[0].status, "pending");
  });

  it("hard rules make a code invalid and it never discounts", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    const cases = [
      [undefined, {}, /recognise/],
      [coupon({ isActive: false }), {}, /no longer active/],
      [coupon({ startsAt: new Date("2026-12-01") }), {}, /isn't active yet/],
      [coupon({ endsAt: new Date("2026-11-16T11:59:59Z") }), {}, /expired/],
      [coupon({ usageLimit: 5, redemptionCount: 5 }), {}, /fully used/],
      [coupon({ perUserLimit: 2 }), { usageCount: 2 }, /already used/],
      [coupon({ firstOrderOnly: true }), { isFirstOrder: false }, /first order/],
    ];
    for (const [c, ctx, msg] of cases) {
      assert.match(couponBlocker(c, { now, ...ctx }), msg);
    }
    assert.equal(couponBlocker(coupon({ endsAt: new Date("2026-11-17") }), { now }), null);

    const expired = coupon({ endsAt: new Date("2020-01-01") });
    const r = run({ couponCodes: ["SAVE"], coupons: [expired] });
    assert.equal(r.coupons[0].status, "invalid");
    assert.equal(total(r), 3348);

    const used = coupon();
    const r2 = run({ couponCodes: ["SAVE"], coupons: [used], couponUsage: new Map([[String(used._id), 1]]) });
    assert.equal(r2.coupons[0].status, "invalid");
    const first = coupon({ firstOrderOnly: true });
    assert.equal(run({ couponCodes: ["SAVE"], coupons: [first], isFirstOrder: false }).coupons[0].status, "invalid");
    assert.equal(run({ couponCodes: ["SAVE"], coupons: [first], isFirstOrder: true }).coupons[0].status, "applied");
  });
});

describe("automatic offers", () => {
  const promo = (over = {}) => ({
    _id: id(),
    name: "Spend £15 save £2",
    scope: "store",
    store: A,
    type: "spend_and_save",
    minSubtotal: 1500,
    discountType: "fixed",
    discountValue: 200,
    maxDiscount: null,
    products: [],
    categories: [],
    fundedBy: "vendor",
    isActive: true,
    ...over,
  });

  it("applies the best single offer per store order", () => {
    const r = run({
      promotions: [promo(), promo({ name: "10% off", discountType: "percent", discountValue: 10 }), promo({ store: B })],
    });
    // £2 off beats 10% (£1.80) on a £17.99 basket; only one applies
    assert.deepEqual(lines(r.groups[0], "discount").map((l) => [l.label, l.amount]), [["Spend £15 save £2", -200]]);
    assert.equal(lines(r.groups[1], "discount").length, 0, "Bravo spends 750, below 1500");
    const nudge = r.groups[1].nearMisses.find((n) => n.kind === "promotion");
    assert.equal(nudge.amountNeeded, 750);
  });

  it("targets products or categories only", () => {
    const r = evaluatePromotion(promo({ categories: [CAT], minSubtotal: 900 }), groups()[0].items);
    assert.equal(r.amount, 200);
    const miss = evaluatePromotion(promo({ categories: [CAT], minSubtotal: 1000 }), groups()[0].items);
    assert.equal(miss.gap, 100);
  });

  it("multibuy frees the cheapest units and nudges when one short", () => {
    const items = [
      { product: P1, unitPrice: 300, quantity: 2 },
      { product: P2, unitPrice: 100, quantity: 1 },
    ];
    const threeForTwo = promo({ type: "multibuy", buyQuantity: 2, getQuantity: 1, products: [P1, P2] });
    assert.equal(evaluatePromotion(threeForTwo, items).amount, 100);
    const short = evaluatePromotion(threeForTwo, [{ product: P1, unitPrice: 300, quantity: 2 }]);
    assert.equal(short.amount, 0);
    assert.equal(short.unitsNeeded, 1);
  });

  it("platform offers are platform-funded and outside dates are ignored", () => {
    const r = run({
      promotions: [
        promo({ scope: "platform", store: null, fundedBy: "platform", minSubtotal: 100 }),
        promo({ name: "old", minSubtotal: 100, discountValue: 900, endsAt: new Date("2020-01-01") }),
      ],
    });
    assert.ok(r.groups.every((g) => lines(g, "discount")[0].fundedBy === "platform"));
    assert.ok(r.groups.every((g) => lines(g, "discount")[0].amount === -200 || g.priced.subtotal < 300));
  });
});

describe("fees, tips and store rules", () => {
  const fees = {
    service: { enabled: true, percent: 2.5, min: 50, max: 200, label: "Service fee", info: "x" },
    smallOrder: { enabled: true, threshold: 1000, amount: 150, label: "Small order fee" },
    bag: { enabled: true, amount: 10, label: "Bags" },
  };

  it("adds itemised fees per store order with who keeps them", () => {
    const r = run({ fees });
    const a = r.groups[0];
    assert.deepEqual(lines(a, "fee").map((l) => [l.code, l.amount, l.fundedBy, l.removable]), [
      ["service", 50, "platform", false], // 2.5% of 1799 = 45 -> min 50
      ["bag", 10, "vendor", true],
    ]);
    const b = r.groups[1];
    assert.deepEqual(lines(b, "fee").map((l) => [l.code, l.amount]), [["small_order", 150], ["service", 50], ["bag", 10]]);
    assert.ok(b.nearMisses.some((n) => n.kind === "small_order_fee" && n.amountNeeded === 250));
    // fees never carry commission unless the store keeps them
    const order = { subtotal: a.priced.subtotal, shippingFee: a.priced.shippingFee, priceLines: a.priced.lines };
    assert.equal(commissionBaseForOrder(order), 2049 + 10);
  });

  it("service fee is capped", () => {
    const big = [{ ...groups()[0], items: [{ product: P1, unitPrice: 100000, quantity: 1 }] }];
    const r = priceCart({ groups: big, fees });
    assert.equal(lines(r.groups[0], "fee").find((l) => l.code === "service").amount, 200);
  });

  it("the bag fee can be declined per store", () => {
    const r = run({ fees, options: { declinedFees: new Map([[String(A), ["bag"]]]) } });
    assert.equal(lines(r.groups[0], "fee").some((l) => l.code === "bag"), false);
    assert.deepEqual(r.groups[0].optionalFees, [{ code: "bag", label: "Bags", amount: 10, removed: true }]);
    assert.equal(lines(r.groups[1], "fee").some((l) => l.code === "bag"), true);
  });

  it("fees are on goods before discounts, so a coupon never changes them", () => {
    const r = run({ fees, couponCodes: ["SAVE"], coupons: [coupon({ value: 1000 })] });
    assert.equal(lines(r.groups[0], "fee").find((l) => l.code === "service").amount, 50);
  });

  it("tips go to the store, outside the commission base", () => {
    const r = run({ options: { tips: { [String(A)]: 150 } } });
    const a = r.groups[0];
    assert.equal(a.priced.tipAmount, 150);
    assert.equal(a.priced.total, 2049 + 150);
    const order = { subtotal: a.priced.subtotal, shippingFee: a.priced.shippingFee, priceLines: a.priced.lines };
    assert.equal(commissionBaseForOrder(order), 2049);
  });

  it("nudges toward free delivery", () => {
    const n = run().groups[0].nearMisses.find((x) => x.kind === "free_delivery");
    assert.equal(n.amountNeeded, 3000 - 1799);
    assert.equal(n.message, "Add £12.01 more for free delivery");
  });

  it("a store minimum order blocks checkout", () => {
    const g = groups();
    g[1].store.minimumOrder = 1000;
    const r = priceCart({ groups: g });
    assert.equal(r.blockingIssues.length, 1);
    assert.equal(r.blockingIssues[0].amountNeeded, 250);
    assert.match(r.blockingIssues[0].message, /Bravo has a £10\.00 minimum order/);
    assert.equal(r.groups[1].nearMisses[0].blocking, true);
  });
});
