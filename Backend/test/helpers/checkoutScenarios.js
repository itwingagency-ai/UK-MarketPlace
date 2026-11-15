/**
 * Checkout totals scenarios, shared by the replica-set (transaction) and the
 * standalone (compensation) test files.
 *
 * These were written and run against the pre-refactor code (commit 181a9c6)
 * first, and every expected number below is what that code produced. They pin
 * the behaviour the Wave 0 pricing refactor must not change.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { startHarness } = require("./harness");
const { model, seedMarketplace, fillStandardCart, checkoutBody } = require("./fixtures");

const pick = (byStore, store) => byStore.find((g) => String(g.storeId) === String(store._id));

const runCheckoutScenarios = ({ replSet }) => {
  describe(`checkout totals (${replSet ? "transaction" : "compensation"} path)`, () => {
    let h;
    let m;

    before(async () => {
      h = await startHarness({ replSet });
    });
    after(async () => {
      await h.stop();
    });
    beforeEach(async () => {
      await h.resetDb();
      m = await seedMarketplace();
    });

    it("cart summary prices each store from the cart snapshot", async () => {
      const cart = await fillStandardCart(h, m);
      assert.equal(cart.totalItems, 7);
      assert.equal(cart.subtotal, 2748);
      assert.equal(cart.shippingFee, 600);
      assert.equal(cart.grandTotal, 3348);

      const a = pick(cart.byStore, m.stores.alpha);
      assert.deepEqual([a.subtotal, a.shippingFee, a.total], [1799, 250, 2049]);
      assert.equal(a.defaultShippingMethod.code, "standard");
      assert.equal(a.defaultShippingMethod.fee, 250);
      assert.deepEqual(a.availableShippingMethods.map((x) => x.fee), [250, 550]);
      const b = pick(cart.byStore, m.stores.bravo);
      assert.deepEqual([b.subtotal, b.shippingFee, b.total], [750, 350, 1100]);
      const c = pick(cart.byStore, m.stores.charlie);
      assert.deepEqual([c.subtotal, c.shippingFee, c.total], [199, 0, 199]);
    });

    it("checkout preview matches the cart and honours a shipping selection", async () => {
      await fillStandardCart(h, m);
      let res = await h.api("GET", "/api/v1/checkout/preview", { token: m.token });
      assert.equal(res.status, 200);
      let p = res.body.data;
      assert.deepEqual([p.subtotal, p.shippingFee, p.grandTotal], [2748, 600, 3348]);
      assert.equal(p.canCheckout, true);
      assert.equal(pick(p.byStore, m.stores.alpha).total, 2049);

      const sel = JSON.stringify([
        { storeId: String(m.stores.alpha._id), shippingMethodId: String(m.methods.express._id) },
      ]);
      res = await h.api("GET", `/api/v1/checkout/preview?shippingSelections=${encodeURIComponent(sel)}`, {
        token: m.token,
      });
      p = res.body.data;
      const a = pick(p.byStore, m.stores.alpha);
      assert.deepEqual([a.subtotal, a.shippingFee, a.total], [1799, 550, 2349]);
      assert.equal(a.selectedShippingMethod.code, "express");
      assert.deepEqual([p.subtotal, p.shippingFee, p.grandTotal], [2748, 900, 3648]);
    });

    it("free-shipping threshold zeroes the fee once reached", async () => {
      await fillStandardCart(h, m);
      await h.api("POST", "/api/v1/cart/items", {
        token: m.token,
        body: { productId: String(m.products.coffee._id), variantId: String(m.coffee1k._id), quantity: 1 },
      });
      const res = await h.api("GET", "/api/v1/checkout/preview", { token: m.token });
      const a = pick(res.body.data.byStore, m.stores.alpha);
      assert.deepEqual([a.subtotal, a.shippingFee, a.total], [3098, 0, 3098]);
      assert.equal(res.body.data.grandTotal, 3098 + 1100 + 199);
    });

    it("preview uses live prices while the cart keeps its snapshot", async () => {
      await fillStandardCart(h, m);
      await model("Product").updateOne({ _id: m.products.bread._id }, { $set: { price: 500 } });

      const cart = await h.api("GET", "/api/v1/cart", { token: m.token });
      assert.equal(pick(cart.body.data.byStore, m.stores.alpha).subtotal, 1799);

      const res = await h.api("GET", "/api/v1/checkout/preview", { token: m.token });
      const p = res.body.data;
      const bread = p.items.find((x) => x.title === "Bread");
      assert.equal(bread.snapshotPrice, 450);
      assert.equal(bread.livePrice, 500);
      assert.equal(bread.priceChanged, true);
      assert.equal(pick(p.byStore, m.stores.alpha).subtotal, 1899);
      assert.equal(p.grandTotal, 3448);
    });

    it("unavailable items block checkout and drop out of store totals", async () => {
      await fillStandardCart(h, m);
      await model("Product").updateOne({ _id: m.products.gum._id }, { $set: { stock: 0 } });
      const res = await h.api("GET", "/api/v1/checkout/preview", { token: m.token });
      const p = res.body.data;
      assert.equal(p.canCheckout, false);
      assert.equal(p.issues.length, 1);
      assert.equal(p.byStore.length, 2);
      assert.equal(p.grandTotal, 3149);

      const place = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      assert.equal(place.status, 409);
    });

    it("COD order per store carries the same totals as the preview", async () => {
      await fillStandardCart(h, m);
      const res = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      assert.equal(res.status, 201, res.text);
      assert.equal(res.body.data.orders.length, 3);
      assert.equal(res.body.data.payment, null);

      const Order = model("Order");
      const orders = await Order.find({ customer: m.customer._id }).lean();
      const byStore = (s) => orders.find((o) => String(o.store) === String(s._id));

      const a = byStore(m.stores.alpha);
      assert.deepEqual([a.subtotal, a.shippingFee, a.total], [1799, 250, 2049]);
      assert.deepEqual(
        a.items.map((i) => [i.title, i.quantity, i.unitPrice, i.total]),
        [["Bread", 2, 450, 900], ["Coffee", 1, 899, 899]]
      );
      assert.equal(a.shippingMethod.code, "standard");
      assert.equal(a.paymentMethod, "cod");
      assert.equal(a.paymentStatus, "pending");
      assert.equal("totalAmount" in a, false, "stray totalAmount must not be persisted");

      const b = byStore(m.stores.bravo);
      assert.deepEqual([b.subtotal, b.shippingFee, b.total], [750, 350, 1100]);
      const c = byStore(m.stores.charlie);
      assert.deepEqual([c.subtotal, c.shippingFee, c.total], [199, 0, 199]);

      const bread = await model("Product").findById(m.products.bread._id).lean();
      assert.equal(bread.stock, 8);
      const coffee = await model("Product").findById(m.products.coffee._id).lean();
      assert.equal(coffee.variants[0].stock, 4);
      const cart = await model("Cart").findOne({ user: m.customer._id }).lean();
      assert.equal(cart.items.length, 0);
    });

    it("a strict shipping selection is applied to the placed order", async () => {
      await fillStandardCart(h, m);
      const res = await h.api("POST", "/api/v1/checkout", {
        token: m.token,
        body: checkoutBody({
          shippingSelections: [
            { storeId: String(m.stores.alpha._id), shippingMethodId: String(m.methods.express._id) },
          ],
        }),
      });
      assert.equal(res.status, 201, res.text);
      const a = await model("Order").findOne({ store: m.stores.alpha._id }).lean();
      assert.deepEqual([a.subtotal, a.shippingFee, a.total], [1799, 550, 2349]);
      assert.equal(a.shippingMethod.code, "express");
    });

    it("mobile card payment: one PaymentIntent for the grand total in pence", async () => {
      await fillStandardCart(h, m);
      const res = await h.api("POST", "/api/v1/checkout", {
        token: m.token,
        body: checkoutBody({ paymentMethod: "online", clientType: "mobile" }),
      });
      assert.equal(res.status, 201, res.text);
      const pay = res.body.data.payment;
      assert.equal(pay.amount, 3348);
      assert.equal(pay.currency, "gbp");
      assert.ok(pay.clientSecret);

      const pi = h.stripeCalls.filter((c) => c.api === "paymentIntents.create");
      assert.equal(pi.length, 1);
      assert.equal(pi[0].args.amount, 3348);
      assert.equal(pi[0].args.currency, "gbp");

      const tx = await model("PaymentTransaction").findById(pay.transactionId).lean();
      assert.equal(tx.amount, 3348);
      assert.equal(tx.currency, "gbp");
      assert.equal(tx.orders.length, 3);
    });

    it("web card payment: Checkout Session line items add up to the grand total", async () => {
      await fillStandardCart(h, m);
      const res = await h.api("POST", "/api/v1/checkout", {
        token: m.token,
        body: checkoutBody({ paymentMethod: "online" }),
      });
      assert.equal(res.status, 201, res.text);
      assert.equal(res.body.data.payment.amount, 3348);

      const cs = h.stripeCalls.filter((c) => c.api === "checkout.sessions.create");
      assert.equal(cs.length, 1);
      const lines = cs[0].args.line_items;
      const sum = lines.reduce((acc, l) => acc + l.quantity * l.price_data.unit_amount, 0);
      assert.equal(sum, 3348);
      assert.ok(lines.every((l) => l.price_data.currency === "gbp"));
      assert.ok(lines.every((l) => Number.isInteger(l.price_data.unit_amount)));
      // 4 product lines + 2 shipping lines (charlie delivers free)
      assert.equal(lines.length, 6);
    });

    it("commission is snapshotted on payment from the order total", async () => {
      await model("Store").updateOne(
        { _id: m.stores.bravo._id },
        { $set: { commissionType: "fixed", commissionFixed: 50 } }
      );
      await fillStandardCart(h, m);
      await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      const Order = model("Order");
      const orders = await Order.find({ customer: m.customer._id });

      // eslint-disable-next-line global-require
      const { markOrdersPaid } = require(path.join(h.src, "lib", "paymentService"));
      await markOrdersPaid({ orderIds: orders.map((o) => o._id), provider: "cod", note: "test" });

      const paid = await Order.find({ customer: m.customer._id }).lean();
      const c = (s) => paid.find((o) => String(o.store) === String(s._id)).commission;
      // platform default: 10% of the order total (shipping included)
      assert.equal(c(m.stores.alpha).type, "percentage");
      assert.equal(c(m.stores.alpha).amount, 204.9);
      assert.equal(c(m.stores.alpha).sourceRate, "platform");
      assert.equal(c(m.stores.charlie).amount, 19.9);
      // store override: fixed 50p
      assert.equal(c(m.stores.bravo).type, "fixed");
      assert.equal(c(m.stores.bravo).amount, 50);
      assert.equal(c(m.stores.bravo).sourceRate, "store");
    });
  });
};

module.exports = { runCheckoutScenarios };
