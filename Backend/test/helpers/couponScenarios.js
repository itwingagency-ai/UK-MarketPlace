/**
 * Wave 1 end-to-end: coupons, fees, tips and order options through the real
 * API. Shared by the transaction and compensation test files.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { startHarness } = require("./harness");
const { model, makeUser, tokenFor, seedMarketplace, fillStandardCart, checkoutBody } = require("./fixtures");

const byStore = (list, store) => list.find((x) => String(x.store || x.storeId) === String(store._id));

const runCouponScenarios = ({ replSet }) => {
  describe(`coupons and fees end to end (${replSet ? "transaction" : "compensation"} path)`, () => {
    let h;
    let m;
    let admin;
    let vendorA;

    before(async () => {
      h = await startHarness({ replSet });
    });
    after(async () => {
      await h.stop();
    });
    beforeEach(async () => {
      await h.resetDb();
      m = await seedMarketplace();
      admin = tokenFor(await makeUser({ role: "admin" }));
      vendorA = tokenFor(await model("User").findOne({ storeId: m.stores.alpha._id }));
    });

    const adminCoupon = (body) => h.api("POST", "/api/v1/admin/coupons", { token: admin, body: { scope: "platform", ...body } });
    const apply = (code, token = m.token) => h.api("POST", "/api/v1/cart/coupon", { token, body: { code } });
    const place = (extra, token = m.token) => h.api("POST", "/api/v1/checkout", { token, body: checkoutBody(extra) });

    it("platform coupon: spread over three orders, one use, Stripe charged the discounted total", async () => {
      assert.equal((await adminCoupon({ code: "WELCOME5", type: "fixed", value: 500 })).status, 201);
      await fillStandardCart(h, m);
      const res = await apply("welcome5");
      assert.equal(res.status, 200, res.text);
      assert.equal(res.body.data.coupons[0].status, "applied");
      assert.equal(res.body.data.grandTotal, 3348 - 500);

      const placed = await place({ paymentMethod: "online", clientType: "mobile" });
      assert.equal(placed.status, 201, placed.text);
      assert.equal(placed.body.data.payment.amount, 2848);
      assert.equal(h.stripeCalls.find((c) => c.api === "paymentIntents.create").args.amount, 2848);

      const orders = await model("Order").find({ customer: m.customer._id }).lean();
      assert.equal(orders.reduce((a, o) => a + o.total, 0), 2848);
      const a = byStore(orders, m.stores.alpha);
      assert.deepEqual(a.priceLines.map((l) => [l.kind, l.code, l.amount, l.fundedBy]), [["coupon", "WELCOME5", -327, "platform"]]);
      assert.equal(a.discountTotal, 327);
      assert.equal(a.total, 2049 - 327);

      const rows = await model("CouponRedemption").find({}).lean();
      assert.equal(rows.length, 3);
      assert.equal(new Set(rows.map((r) => r.checkoutId)).size, 1);
      assert.equal(rows.reduce((acc, r) => acc + r.amount, 0), 500);
      const coupon = await model("Coupon").findOne({ code: "WELCOME5" }).lean();
      assert.equal(coupon.redemptionCount, 1);

      const cart = await model("Cart").findOne({ user: m.customer._id }).lean();
      assert.deepEqual(cart.couponCodes, []);
    });

    it("web Checkout Session charges one line per discounted order", async () => {
      await adminCoupon({ code: "WEB5", type: "fixed", value: 500 });
      await fillStandardCart(h, m);
      await apply("WEB5");
      const placed = await place({ paymentMethod: "online" });
      assert.equal(placed.status, 201, placed.text);
      const lines = h.stripeCalls.find((c) => c.api === "checkout.sessions.create").args.line_items;
      assert.equal(lines.length, 3);
      assert.equal(lines.reduce((a, l) => a + l.quantity * l.price_data.unit_amount, 0), 2848);
    });

    it("rejects unknown, expired and first-order codes when applied", async () => {
      await fillStandardCart(h, m);
      assert.equal((await apply("NOPE")).status, 404);
      const ended = await adminCoupon({ code: "OLD", type: "fixed", value: 100, endsAt: "2020-01-01" });
      assert.equal(ended.status, 400, "can't create a coupon that has already ended");
      await adminCoupon({ code: "OLD", type: "fixed", value: 100 });
      await model("Coupon").updateOne({ code: "OLD" }, { $set: { endsAt: new Date(Date.now() - 1000) } });
      const expired = await apply("OLD");
      assert.equal(expired.status, 409);
      assert.match(expired.body.message, /expired/);

      await adminCoupon({ code: "FIRST", type: "percent", value: 20, firstOrderOnly: true });
      assert.equal((await apply("FIRST")).status, 200);
      await h.api("DELETE", "/api/v1/cart/coupon/FIRST", { token: m.token });
      assert.equal((await place()).status, 201);
      await fillStandardCart(h, m);
      const again = await apply("FIRST");
      assert.equal(again.status, 409);
      assert.match(again.body.message, /first order/);
    });

    it("usage limit: the second checkout racing for the last use loses at placement", async () => {
      await adminCoupon({ code: "LAST1", type: "fixed", value: 100, usageLimit: 1 });
      const other = await makeUser();
      const otherToken = tokenFor(other);
      await fillStandardCart(h, m);
      await fillStandardCart(h, { ...m, token: otherToken });
      assert.equal((await apply("LAST1")).status, 200);
      assert.equal((await apply("LAST1", otherToken)).status, 200);

      assert.equal((await place()).status, 201);
      const lost = await place({}, otherToken);
      assert.equal(lost.status, 409, lost.text);

      // nothing of the losing checkout was kept
      assert.equal(await model("Order").countDocuments({ customer: other._id }), 0);
      assert.equal(await model("CouponRedemption").countDocuments({ user: other._id }), 0);
      const coupon = await model("Coupon").findOne({ code: "LAST1" }).lean();
      assert.equal(coupon.redemptionCount, 1);
      const milk = await model("Product").findById(m.products.milk._id).lean();
      assert.equal(milk.stock, 20 - 3, "loser's stock went back");
    });

    it("per-user limit: a code can't be reused, until its order is cancelled", async () => {
      await adminCoupon({ code: "ONCE", type: "fixed", value: 100 });
      // single-store basket so one cancellation releases the whole checkout
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.milk._id), quantity: 2 } });
      await apply("ONCE");
      const placed = await place();
      assert.equal(placed.status, 201, placed.text);
      const orderId = placed.body.data.orders[0].id;

      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.milk._id), quantity: 1 } });
      assert.equal((await apply("ONCE")).status, 409);

      const cancel = await h.api("POST", `/api/v1/customer/orders/${orderId}/cancel`, { token: m.token, body: {} });
      assert.equal(cancel.status, 200, cancel.text);
      const row = await model("CouponRedemption").findOne({ order: orderId }).lean();
      assert.equal(row.status, "released");
      assert.equal((await model("Coupon").findOne({ code: "ONCE" }).lean()).redemptionCount, 0);
      assert.equal((await model("CouponUsage").findOne({}).lean()).count, 0);
      assert.equal((await apply("ONCE")).status, 200);
    });

    it("a multi-store use is given back only when every order of it is cancelled", async () => {
      await adminCoupon({ code: "SPLIT", type: "fixed", value: 300 });
      await fillStandardCart(h, m);
      await apply("SPLIT");
      const placed = await place();
      const ids = placed.body.data.orders.map((o) => o.id);

      await h.api("POST", `/api/v1/customer/orders/${ids[0]}/cancel`, { token: m.token, body: {} });
      assert.equal((await model("Coupon").findOne({ code: "SPLIT" }).lean()).redemptionCount, 1);

      // vendor cancels theirs, payment-failure path cancels the last
      const alphaOrder = await model("Order").findOne({ _id: { $in: ids.slice(1) }, store: m.stores.alpha._id });
      const remaining = ids.slice(1).filter((x) => String(x) !== String(alphaOrder?._id));
      if (alphaOrder) {
        const v = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${alphaOrder._id}/status`, {
          token: vendorA,
          body: { orderStatus: "cancelled" },
        });
        assert.equal(v.status, 200, v.text);
      }
      // eslint-disable-next-line global-require
      const { cancelOrdersAndRestoreStock } = require(path.join(h.src, "lib", "paymentService"));
      await cancelOrdersAndRestoreStock({ orderIds: remaining, reason: "Payment failed" });

      assert.equal(await model("CouponRedemption").countDocuments({ status: "active" }), 0);
      assert.equal((await model("Coupon").findOne({ code: "SPLIT" }).lean()).redemptionCount, 0);
    });

    it("commission: platform-funded coupon leaves the vendor whole; vendor-funded lowers the base", async () => {
      await adminCoupon({ code: "PLAT", type: "fixed", value: 500 });
      const vc = await h.api("POST", "/api/v1/vendor/dashboard/coupons", {
        token: vendorA,
        body: { code: "ALPHA2", type: "fixed", value: 200, fundedBy: "platform", scope: "platform" },
      });
      assert.equal(vc.status, 201, vc.text);
      assert.equal(vc.body.data.scope, "store", "vendors can only make store coupons");
      assert.equal(vc.body.data.fundedBy, "vendor", "vendors always fund their own coupons");

      await fillStandardCart(h, m);
      await apply("PLAT");
      await apply("ALPHA2");
      await place();
      const orders = await model("Order").find({ customer: m.customer._id });
      // eslint-disable-next-line global-require
      const { markOrdersPaid } = require(path.join(h.src, "lib", "paymentService"));
      await markOrdersPaid({ orderIds: orders.map((o) => o._id), provider: "cod" });

      const a = await model("Order").findOne({ store: m.stores.alpha._id }).lean();
      // goods 1799 - ALPHA2 200 = 1599; PLAT share of 500 over goods-left [1599, 750, 199]
      const platShare = -a.priceLines.find((l) => l.code === "PLAT").amount;
      assert.equal(a.total, 2049 - 200 - platShare);
      assert.equal(a.commission.base, 2049 - 200);
      assert.equal(a.commission.amount, 184.9);
      assert.equal(a.commission.vendorNet, 2049 - 200 - 184.9);

      const b = await model("Order").findOne({ store: m.stores.bravo._id }).lean();
      assert.equal(b.commission.base, 1100, "platform coupon doesn't touch Bravo's base");
      assert.equal(b.commission.vendorNet, 1100 - 110);
      assert.ok(b.total < 1100);

      const ledger = await h.api("GET", "/api/v1/vendor/dashboard/commission/ledger", { token: vendorA });
      assert.equal(ledger.status, 200, ledger.text);
      assert.equal(ledger.body.totals.netPayout, 2049 - 200 - 184.9);
    });

    it("fees, tip, note and substitutions land on the order; the cart's one-offs are cleared", async () => {
      const s = await h.api("PATCH", "/api/v1/admin/settings", {
        token: admin,
        body: { fees: { service: { enabled: true, percent: 2, min: 25 }, bag: { enabled: true, amount: 10 } } },
      });
      assert.equal(s.status, 200, s.text);
      await fillStandardCart(h, m);
      const alpha = String(m.stores.alpha._id);
      assert.equal((await h.api("PUT", "/api/v1/cart/tip", { token: m.token, body: { storeId: alpha, amount: 200 } })).status, 200);
      assert.equal((await h.api("PUT", "/api/v1/cart/tip", { token: m.token, body: { storeId: alpha, amount: 1.5 } })).status, 400);
      const opt = await h.api("PUT", "/api/v1/cart/options", {
        token: m.token,
        body: {
          allowSubstitutions: false,
          stores: [
            { storeId: alpha, note: "Ring the bell twice" },
            { storeId: String(m.stores.bravo._id), bags: false },
          ],
        },
      });
      assert.equal(opt.status, 200, opt.text);
      const preview = (await h.api("GET", "/api/v1/checkout/preview", { token: m.token })).body.data;
      const pa = byStore(preview.byStore, m.stores.alpha);
      assert.deepEqual(pa.lines.map((l) => [l.code, l.amount]), [["service", 36], ["bag", 10], ["tip", 200]]);
      assert.equal(pa.note, "Ring the bell twice");
      const pb = byStore(preview.byStore, m.stores.bravo);
      assert.deepEqual(pb.lines.map((l) => l.code), ["service"]);
      assert.equal(pb.optionalFees[0].removed, true);

      assert.equal((await place()).status, 201);
      const a = await model("Order").findOne({ store: m.stores.alpha._id }).lean();
      assert.equal(a.total, 2049 + 36 + 10 + 200);
      assert.equal(a.feeTotal, 46);
      assert.equal(a.tipAmount, 200);
      assert.equal(a.customerNote, "Ring the bell twice");
      assert.equal(a.allowSubstitutions, false);
      const b = await model("Order").findOne({ store: m.stores.bravo._id }).lean();
      assert.equal(b.customerNote, "");

      const cart = await model("Cart").findOne({ user: m.customer._id }).lean();
      assert.deepEqual([cart.couponCodes, cart.tips, cart.notes, cart.declinedFees], [[], {}, {}, {}]);
      assert.equal(cart.allowSubstitutions, false, "a standing preference survives");
    });

    it("a store minimum order blocks checkout with a clear message", async () => {
      await model("Store").updateOne({ _id: m.stores.bravo._id }, { $set: { minimumOrder: 1000 } });
      await fillStandardCart(h, m);
      const preview = (await h.api("GET", "/api/v1/checkout/preview", { token: m.token })).body.data;
      assert.equal(preview.canCheckout, false);
      const res = await place();
      assert.equal(res.status, 409);
      assert.match(res.body.message, /£10\.00 minimum order/);
    });

    it("vendors manage only their own coupons; used coupons are switched off, not deleted", async () => {
      const vendorB = tokenFor(await model("User").findOne({ storeId: m.stores.bravo._id }));
      const created = await h.api("POST", "/api/v1/vendor/dashboard/coupons", {
        token: vendorA,
        body: { code: "MINE", type: "percent", value: 10 },
      });
      const couponId = created.body.data._id;
      assert.equal((await h.api("PATCH", `/api/v1/vendor/dashboard/coupons/${couponId}`, { token: vendorB, body: { value: 50 } })).status, 404);
      const listB = await h.api("GET", "/api/v1/vendor/dashboard/coupons", { token: vendorB });
      assert.equal(listB.body.data.length, 0);

      await fillStandardCart(h, m);
      await apply("MINE");
      await place();
      const report = await h.api("GET", "/api/v1/vendor/dashboard/coupons/redemptions", { token: vendorA });
      assert.equal(report.status, 200, report.text);
      assert.equal(report.body.totals.vendor.amount, 180);
      assert.equal(report.body.data[0].user.email, undefined, "vendors don't see customer emails");

      const locked = await h.api("PATCH", `/api/v1/vendor/dashboard/coupons/${couponId}`, { token: vendorA, body: { code: "OTHER" } });
      assert.equal(locked.status, 409);
      const del = await h.api("DELETE", `/api/v1/vendor/dashboard/coupons/${couponId}`, { token: vendorA });
      assert.equal(del.status, 200);
      assert.equal((await model("Coupon").findById(couponId).lean()).isActive, false);

      const adminReport = await h.api("GET", "/api/v1/admin/coupons/redemptions", { token: admin });
      assert.equal(adminReport.body.totals.amount, 180);
      assert.ok(adminReport.body.data[0].user.email);
    });

    it("an automatic offer from the vendor portal applies at checkout", async () => {
      const promo = await h.api("POST", "/api/v1/vendor/dashboard/promotions", {
        token: vendorA,
        body: {
          name: "3 for 2 bread",
          type: "multibuy",
          buyQuantity: 2,
          getQuantity: 1,
          products: [String(m.products.bread._id)],
        },
      });
      assert.equal(promo.status, 201, promo.text);
      const foreign = await h.api("POST", "/api/v1/vendor/dashboard/promotions", {
        token: vendorA,
        body: { name: "Bad", type: "multibuy", buyQuantity: 1, getQuantity: 1, products: [String(m.products.milk._id)] },
      });
      assert.equal(foreign.status, 400, "can't target another store's products");

      await fillStandardCart(h, m); // 2 bread
      let cart = (await h.api("GET", "/api/v1/cart", { token: m.token })).body.data;
      const nudge = byStore(cart.byStore, m.stores.alpha).nearMisses.find((n) => n.kind === "promotion");
      assert.match(nudge.message, /Add 1 more to unlock 3 for 2 bread/);

      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.bread._id), quantity: 1 } });
      cart = (await h.api("GET", "/api/v1/cart", { token: m.token })).body.data;
      const a = byStore(cart.byStore, m.stores.alpha);
      assert.deepEqual(a.lines.map((l) => [l.kind, l.amount, l.fundedBy]), [["discount", -450, "vendor"]]);
      assert.equal((await place()).status, 201);
      const order = await model("Order").findOne({ store: m.stores.alpha._id }).lean();
      assert.equal(order.discountTotal, 450);
    });
  });
};

module.exports = { runCouponScenarios };
