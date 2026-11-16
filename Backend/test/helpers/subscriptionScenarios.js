/**
 * Wave 6 end-to-end: repeat orders placed by the scheduler through the
 * normal checkout code, cash and off-session card, failures and pausing.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { startHarness } = require("./harness");
const { model, makeUser, tokenFor, seedMarketplace, checkoutBody } = require("./fixtures");

const runSubscriptionScenarios = ({ replSet }) => {
  describe(`repeat orders end to end (${replSet ? "transaction" : "compensation"} path)`, () => {
    let h;
    let m;
    let subs;
    let orderId;

    before(async () => {
      h = await startHarness({ replSet });
      // eslint-disable-next-line global-require
      subs = require(path.join(h.src, "lib", "subscriptions"));
    });
    after(async () => {
      await h.stop();
    });
    beforeEach(async () => {
      await h.resetDb();
      m = await seedMarketplace();
      // A first order to repeat: 2 bread + 1 coffee from Alpha
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.bread._id), quantity: 2 } });
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.coffee._id), variantId: String(m.coffee250._id), quantity: 1 } });
      const placed = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      assert.equal(placed.status, 201, placed.text);
      orderId = placed.body.data.orders[0].id;
    });

    const create = (body, token = m.token) =>
      h.api("POST", "/api/v1/customer/subscriptions", { token, body: { orderId, every: "week", weekday: 1, ...body } });
    const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dueNow = async (sub) => model("Subscription").updateOne({ _id: sub._id }, { $set: { nextRunOn: yesterday() } });

    it("set up from an order; validation and ownership", async () => {
      const stranger = tokenFor(await makeUser());
      assert.equal((await create({ paymentMethod: "cod" }, stranger)).status, 404);
      assert.equal((await create({ paymentMethod: "cod", every: "daily" })).status, 400);
      assert.equal((await create({ paymentMethod: "cod", every: "month", dayOfMonth: 31 })).status, 400);
      assert.equal((await create({ paymentMethod: "card", paymentMethodId: "pm_test_1" })).status, 404, "no saved card yet");
      const res = await create({ paymentMethod: "cod", preferredTime: "09:00" });
      assert.equal(res.status, 201, res.text);
      const sub = res.body.data;
      assert.equal(sub.items.length, 2);
      assert.equal(sub.method, "delivery");
      assert.equal(sub.shippingAddress.line1, "1 Test Street");
      assert.equal(sub.upcoming.length, 4);
      assert.ok(sub.nextRunOn > new Date().toISOString().slice(0, 10), "starts after today");
      assert.equal(new Date(`${sub.nextRunOn}T12:00:00Z`).getUTCDay(), 1, "a Monday");
    });

    it("a due cash repeat order is placed through checkout at live prices; the customer's own basket is untouched", async () => {
      const sub = (await create({ paymentMethod: "cod" })).body.data;
      await dueNow(sub);
      await model("Product").updateOne({ _id: m.products.bread._id }, { $set: { price: 500 } });
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.milk._id), quantity: 1 } });
      const other = await makeUser();
      await h.api("POST", "/api/v1/cart/items", { token: tokenFor(other), body: { productId: String(m.products.gum._id), quantity: 1 } });

      const out = await subs.runDueSubscriptions();
      assert.equal(out.ran, 1);
      const order = await model("Order").findOne({ subscription: sub._id }).lean();
      assert.ok(order, "order created");
      assert.equal(order.subtotal, 2 * 500 + 899, "today's prices");
      assert.equal(order.paymentMethod, "cod");
      assert.equal(order.shippingAddress.line1, "1 Test Street");

      assert.equal((await model("Cart").findOne({ user: m.customer._id }).lean()).items.length, 1, "my basket still has the milk");
      assert.equal((await model("Cart").findOne({ user: other._id }).lean()).items.length, 1, "nobody else's basket was touched");

      const after = await model("Subscription").findById(sub._id).lean();
      assert.equal(after.failures, 0);
      assert.ok(after.nextRunOn > new Date().toISOString().slice(0, 10), "moved on to a future date");
      assert.equal(String(after.lastOrder), String(order._id));

      // Running again does nothing: it isn't due any more
      assert.equal((await subs.runDueSubscriptions()).ran, 0);
      assert.equal(await model("Order").countDocuments({ subscription: sub._id }), 1);
    });

    it("goes ahead without items that are out of stock, and says so", async () => {
      const sub = (await create({ paymentMethod: "cod" })).body.data;
      await dueNow(sub);
      await model("Product").updateOne({ _id: m.products.coffee._id, "variants._id": m.coffee250._id }, { $set: { "variants.$.stock": 0 } });
      const out = await subs.runDueSubscriptions();
      assert.equal(out.results[0].ok, true);
      assert.match(out.results[0].message, /Coffee wasn't available/);
      const order = await model("Order").findOne({ subscription: sub._id }).lean();
      assert.deepEqual(order.items.map((i) => i.title), ["Bread"]);
    });

    it("card: charged off-session and marked paid; declines retry tomorrow, then pause after 3", async () => {
      await model("User").updateOne({ _id: m.customer._id }, { $set: { stripeCustomerId: "cus_test_1" } });
      const setup = await h.api("POST", "/api/v1/me/payment-methods/setup", { token: m.token, body: {} });
      assert.equal(setup.status, 200, setup.text);
      assert.ok(setup.body.data.setupIntentClientSecret);
      assert.equal(h.stripeCalls.find((c) => c.api === "setupIntents.create").args.usage, "off_session");

      const good = (await create({ paymentMethod: "card", paymentMethodId: "pm_test_1" })).body.data;
      assert.equal(good.cardLabel, "VISA •••• 4242");
      await dueNow(good);
      await subs.runDueSubscriptions();
      const paid = await model("Order").findOne({ subscription: good._id }).lean();
      assert.equal(paid.paymentStatus, "paid");
      const pi = h.stripeCalls.filter((c) => c.api === "paymentIntents.create").pop().args;
      assert.equal(pi.off_session, true);
      assert.equal(pi.customer, "cus_test_1");
      assert.equal(pi.amount, paid.total);

      await model("Subscription").updateOne({ _id: good._id }, { $set: { status: "cancelled" } });
      const bad = (await create({ paymentMethod: "card", paymentMethodId: "pm_decline" })).body.data;
      const stockBefore = (await model("Product").findById(m.products.bread._id).lean()).stock;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        await dueNow(bad);
        // eslint-disable-next-line no-await-in-loop
        const out = await subs.runDueSubscriptions();
        assert.equal(out.results[0].ok, false);
        assert.match(out.results[0].message, /declined \(insufficient funds\)/);
        // eslint-disable-next-line no-await-in-loop
        const s = await model("Subscription").findById(bad._id).lean();
        assert.equal(s.failures, attempt);
        assert.equal(s.status, attempt < 3 ? "active" : "paused");
      }
      const s = await model("Subscription").findById(bad._id).lean();
      assert.match(s.pausedReason, /3 failed tries/);
      const failedOrders = await model("Order").find({ customer: m.customer._id, subscription: null, orderStatus: "cancelled" }).lean();
      assert.equal(failedOrders.length, 3, "each declined attempt's order was cancelled");
      assert.equal((await model("Product").findById(m.products.bread._id).lean()).stock, stockBefore, "stock came back every time");
    });

    it("skip, pause and resume; vendors see what's coming", async () => {
      const sub = (await create({ paymentMethod: "cod" })).body.data;
      const first = sub.upcoming[0];
      const skip = await h.api("PATCH", `/api/v1/customer/subscriptions/${sub._id}`, { token: m.token, body: { action: "skip", date: first } });
      assert.equal(skip.status, 200, skip.text);
      assert.ok(!skip.body.data.upcoming.includes(first));
      await model("Subscription").updateOne({ _id: sub._id }, { $set: { nextRunOn: yesterday(), skipDates: [yesterday()] } });
      const out = await subs.runDueSubscriptions();
      assert.equal(out.ran, 0);
      assert.equal(await model("Order").countDocuments({ subscription: sub._id }), 0, "skipped day placed nothing");

      const vendor = tokenFor(await model("User").findOne({ storeId: m.stores.alpha._id }));
      const coming = await h.api("GET", "/api/v1/vendor/dashboard/subscriptions/upcoming?days=21", { token: vendor });
      assert.equal(coming.status, 200, coming.text);
      assert.ok(coming.body.data.length >= 2);
      assert.deepEqual(coming.body.data[0].items.map((i) => i.title), ["Bread", "Coffee"]);

      await h.api("PATCH", `/api/v1/customer/subscriptions/${sub._id}`, { token: m.token, body: { action: "pause" } });
      await model("Subscription").updateOne({ _id: sub._id }, { $set: { nextRunOn: yesterday() } });
      assert.equal((await subs.runDueSubscriptions()).ran, 0, "paused ones don't run");
      const resumed = await h.api("PATCH", `/api/v1/customer/subscriptions/${sub._id}`, { token: m.token, body: { action: "resume" } });
      assert.ok(resumed.body.data.nextRunOn > new Date().toISOString().slice(0, 10), "resumes in the future, not with a backlog");
    });

    it("two schedulers at once place the order only once", async () => {
      const sub = (await create({ paymentMethod: "cod" })).body.data;
      await dueNow(sub);
      await Promise.all([subs.runDueSubscriptions(), subs.runDueSubscriptions(), subs.runSubscription(sub._id)]);
      assert.equal(await model("Order").countDocuments({ subscription: sub._id }), 1);
    });
  });
};

module.exports = { runSubscriptionScenarios };
