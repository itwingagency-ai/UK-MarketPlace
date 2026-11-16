/**
 * Wave 4 end-to-end: riders, proof of delivery, age checks and refusals,
 * unavailable / substituted items with partial refunds, live location.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { startHarness } = require("./harness");
const { model, makeUser, tokenFor, seedMarketplace, checkoutBody } = require("./fixtures");

const runDeliveryScenarios = ({ replSet }) => {
  describe(`riders, age checks and item changes end to end (${replSet ? "transaction" : "compensation"} path)`, () => {
    let h;
    let m;
    let vendorA;
    let vendorB;

    before(async () => {
      h = await startHarness({ replSet });
    });
    after(async () => {
      await h.stop();
    });
    beforeEach(async () => {
      await h.resetDb();
      m = await seedMarketplace();
      vendorA = tokenFor(await model("User").findOne({ storeId: m.stores.alpha._id }));
      vendorB = tokenFor(await model("User").findOne({ storeId: m.stores.bravo._id }));
    });

    const addRider = async (token = vendorA, email = "rider@example.test") => {
      const res = await h.api("POST", "/api/v1/vendor/dashboard/riders", {
        token,
        body: { name: "Riley Rider", email, phone: "07700900000", password: "RidePass1" },
      });
      assert.equal(res.status, 201, res.text);
      return res.body.data;
    };
    const loginToken = async (email, password) => {
      const res = await h.api("POST", "/api/v1/auth/login", { body: { email, password } });
      assert.equal(res.status, 200, res.text);
      return res.body.accessToken;
    };
    const add = (productId, quantity, token = m.token) =>
      h.api("POST", "/api/v1/cart/items", { token, body: { productId: String(productId), quantity } });
    const placeAlpha = async (extra = {}) => {
      const res = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody(extra) });
      assert.equal(res.status, 201, res.text);
      return model("Order").findOne({ customer: m.customer._id, store: m.stores.alpha._id }).sort({ createdAt: -1 });
    };
    const status = (orderId, orderStatus, extra = {}) =>
      h.api("PATCH", `/api/v1/vendor/dashboard/orders/${orderId}/status`, { token: vendorA, body: { orderStatus, ...extra } });
    const markCardPaid = async (order) => {
      // eslint-disable-next-line global-require
      const { markOrdersPaid } = require(path.join(h.src, "lib", "paymentService"));
      await model("PaymentTransaction").updateMany({ orders: order._id }, { $set: { status: "succeeded" } });
      await markOrdersPaid({ orderIds: [order._id], provider: "stripe" });
    };

    it("vendors add riders; riders sign in, see only their deliveries, and can't use vendor screens", async () => {
      const weak = await h.api("POST", "/api/v1/vendor/dashboard/riders", {
        token: vendorA, body: { name: "Weak", email: "weak@example.test", password: "short" },
      });
      assert.equal(weak.status, 400);
      const rider = await addRider();
      const riderToken = await loginToken("rider@example.test", "RidePass1");
      assert.equal((await h.api("GET", "/api/v1/vendor/dashboard/orders", { token: riderToken })).status, 403);
      assert.equal((await h.api("GET", "/api/v1/rider/orders", { token: m.token })).status, 403);

      await add(m.products.bread._id, 2);
      const order = await placeAlpha();
      const otherStore = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorB, body: { riderId: rider._id } });
      assert.equal(otherStore.status, 404, "Bravo can't touch Alpha's order");
      const bravoRider = await addRider(vendorB, "brider@example.test");
      const wrongRider = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorA, body: { riderId: bravoRider._id } });
      assert.equal(wrongRider.status, 404, "only the store's own riders");

      assert.equal((await h.api("GET", `/api/v1/rider/orders/${order._id}`, { token: riderToken })).status, 404);
      const assign = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorA, body: { riderId: rider._id } });
      assert.equal(assign.status, 200, assign.text);
      const mine = await h.api("GET", "/api/v1/rider/orders", { token: riderToken });
      assert.equal(mine.body.data.length, 1);
      assert.equal(mine.body.data[0].store.name, "alpha");

      await h.api("PATCH", `/api/v1/vendor/dashboard/riders/${rider._id}`, { token: vendorA, body: { status: "suspended" } });
      assert.equal((await h.api("GET", "/api/v1/rider/orders", { token: riderToken })).status, 403, "suspended riders are locked out");
    });

    it("pick-up and delivery with proof; cash is taken and commission set on delivery", async () => {
      const rider = await addRider();
      const riderToken = await loginToken("rider@example.test", "RidePass1");
      await add(m.products.bread._id, 2);
      const order = await placeAlpha();
      assert.equal(order.shippingAddress.lat, 51.52, "the customer's coordinates are kept for the rider");
      await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorA, body: { riderId: rider._id } });

      assert.equal((await h.api("POST", `/api/v1/rider/orders/${order._id}/pickup`, { token: riderToken })).status, 409, "not accepted yet");
      await status(order._id, "confirmed");
      const up = await h.api("POST", `/api/v1/rider/orders/${order._id}/pickup`, { token: riderToken });
      assert.equal(up.status, 200, up.text);
      let o = await model("Order").findById(order._id).lean();
      assert.equal(o.orderStatus, "shipped");
      assert.deepEqual(o.statusHistory.map((x) => x.status), ["pending", "confirmed", "packed", "shipped"]);
      assert.equal(o.statusHistory[3].changedByRole, "rider");

      const noProof = await h.api("POST", `/api/v1/rider/orders/${order._id}/deliver`, { token: riderToken, body: {} });
      assert.equal(noProof.status, 400);
      const done = await h.api("POST", `/api/v1/rider/orders/${order._id}/deliver`, { token: riderToken, body: { recipientName: "Neighbour at no. 3" } });
      assert.equal(done.status, 200, done.text);
      o = await model("Order").findById(order._id).lean();
      assert.equal(o.orderStatus, "delivered");
      assert.equal(o.paymentStatus, "paid");
      assert.equal(o.commission.amount, 115);
      assert.equal(o.delivery.proof.recipientName, "Neighbour at no. 3");
      assert.ok(o.delivery.pickedUpAt && o.delivery.deliveredAt);
      const done24 = await h.api("GET", "/api/v1/rider/orders?scope=done", { token: riderToken });
      assert.equal(done24.body.data.length, 1);
    });

    it("age-restricted: confirmed at checkout, ID checked at the door, or refused and refunded", async () => {
      await model("Product").updateOne({ _id: m.products.coffee._id }, { $set: { minAge: 18 } });
      const rider = await addRider();
      const riderToken = await loginToken("rider@example.test", "RidePass1");
      await add(m.products.bread._id, 2); // 900
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.coffee._id), variantId: String(m.coffee250._id), quantity: 1 } });
      const cart = await h.api("GET", "/api/v1/cart", { token: m.token });
      assert.equal(cart.body.data.ageCheck, 18);

      const unconfirmed = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody({ paymentMethod: "online", clientType: "mobile" }) });
      assert.equal(unconfirmed.status, 400);
      assert.match(unconfirmed.body.message, /18 or over/);

      const order = await placeAlpha({ paymentMethod: "online", clientType: "mobile", ageConfirmed: true });
      assert.equal(order.ageCheck, 18);
      assert.ok(order.ageConfirmedAt);
      assert.equal(order.total, 1799 + 250);
      await markCardPaid(order);
      await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorA, body: { riderId: rider._id } });
      await status(order._id, "confirmed");
      await h.api("POST", `/api/v1/rider/orders/${order._id}/pickup`, { token: riderToken });

      const noId = await h.api("POST", `/api/v1/rider/orders/${order._id}/deliver`, { token: riderToken, body: { recipientName: "Sam" } });
      assert.equal(noId.status, 400);
      assert.match(noId.body.message, /photo ID/);

      const before = (await model("Product").findById(m.products.coffee._id).lean()).variants[0].stock;
      const refused = await h.api("POST", `/api/v1/rider/orders/${order._id}/deliver`, {
        token: riderToken,
        body: { recipientName: "Sam", refuseRestricted: "true" },
      });
      assert.equal(refused.status, 200, refused.text);
      const o = await model("Order").findById(order._id).lean();
      assert.equal(o.orderStatus, "delivered");
      const coffee = o.items.find((i) => i.title === "Coffee");
      assert.equal(coffee.lineStatus, "refused");
      assert.equal(o.subtotal, 900);
      assert.equal(o.total, 900 + 250);
      assert.equal(o.refunds.length, 1);
      assert.equal(o.refunds[0].amount, 899);
      const partial = h.stripeCalls.filter((c) => c.api === "refunds.create");
      assert.equal(partial.length, 1);
      assert.equal(partial[0].args.amount, 899);
      assert.equal(o.commission.base, 1150, "commission follows the smaller order");
      const after = (await model("Product").findById(m.products.coffee._id).lean()).variants[0].stock;
      assert.equal(after, before + 1, "the refused coffee went back on the shelf once");
    });

    it("everything refused: the order is cancelled, refunded in full, and stock returns once", async () => {
      await model("Product").updateOne({ _id: m.products.bread._id }, { $set: { minAge: 18 } });
      const rider = await addRider();
      const riderToken = await loginToken("rider@example.test", "RidePass1");
      await add(m.products.bread._id, 3);
      const order = await placeAlpha({ ageConfirmed: true });
      await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorA, body: { riderId: rider._id } });
      await status(order._id, "confirmed");
      await h.api("POST", `/api/v1/rider/orders/${order._id}/pickup`, { token: riderToken });
      const res = await h.api("POST", `/api/v1/rider/orders/${order._id}/deliver`, {
        token: riderToken,
        body: { recipientName: "Sam", refuseRestricted: "true" },
      });
      assert.equal(res.status, 200, res.text);
      const o = await model("Order").findById(order._id).lean();
      assert.equal(o.orderStatus, "cancelled");
      assert.equal((await model("Product").findById(m.products.bread._id).lean()).stock, 10, "back to the starting 10, not 13");
    });

    it("unavailable items: whole or part of a line, partial card refund, commission and stock follow", async () => {
      await add(m.products.bread._id, 4); // 1800
      const order = await placeAlpha({ paymentMethod: "online", clientType: "mobile" });
      await markCardPaid(order);
      const part = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/items/0`, {
        token: vendorA,
        body: { action: "unavailable", quantity: 1 },
      });
      assert.equal(part.status, 200, part.text);
      assert.match(part.body.message, /£4\.50 goes back/);
      let o = await model("Order").findById(order._id).lean();
      assert.equal(o.items[0].quantity, 3);
      assert.equal(o.items[0].originalQuantity, 4);
      assert.equal(o.total, 1350 + 250);
      assert.equal(o.commission.amount, 160);
      assert.equal((await model("Product").findById(m.products.bread._id).lean()).stock, 10 - 4 + 1);

      assert.equal((await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/items/0`, { token: vendorA, body: { action: "unavailable", quantity: 9 } })).status, 400);
      await status(order._id, "confirmed");
      await status(order._id, "packed");
      await status(order._id, "shipped");
      const late = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/items/0`, { token: vendorA, body: { action: "unavailable" } });
      assert.equal(late.status, 409, "too late once it's out for delivery");
      o = await model("Order").findById(order._id).lean();
      assert.deepEqual(h.stripeCalls.filter((c) => c.api === "refunds.create").map((c) => c.args.amount), [450]);
    });

    it("substitutions: only if allowed, never dearer, cheaper refunds the difference", async () => {
      await add(m.products.bread._id, 2); // 900
      await h.api("PUT", "/api/v1/cart/options", { token: m.token, body: { allowSubstitutions: false } });
      let order = await placeAlpha();
      const denied = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/items/0`, {
        token: vendorA,
        body: { action: "substitute", productId: String(m.products.coffee._id), variantId: String(m.coffee250._id) },
      });
      assert.equal(denied.status, 409);

      await h.api("PUT", "/api/v1/cart/options", { token: m.token, body: { allowSubstitutions: true } });
      await add(m.products.bread._id, 2);
      order = await placeAlpha();
      // Coffee 250g is dearer (899 > 450): the customer still pays 450 each
      const dear = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/items/0`, {
        token: vendorA,
        body: { action: "substitute", productId: String(m.products.coffee._id), variantId: String(m.coffee250._id) },
      });
      assert.equal(dear.status, 200, dear.text);
      const o = await model("Order").findById(order._id).lean();
      assert.equal(o.items[0].title, "Coffee");
      assert.equal(o.items[0].substitutedFor, "Bread");
      assert.equal(o.items[0].unitPrice, 450);
      assert.equal(o.total, 900 + 250);
      const coffee = await model("Product").findById(m.products.coffee._id).lean();
      assert.equal(coffee.variants[0].stock, 5 - 2);

      // A cheaper swap gives the difference back (COD: less to pay at the door)
      const rolls = await model("Product").create({ store: m.stores.alpha._id, title: "Bread rolls", slug: "rolls", price: 300, stock: 10 });
      await add(m.products.bread._id, 2);
      const third = await placeAlpha();
      const cheap = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${third._id}/items/0`, {
        token: vendorA,
        body: { action: "substitute", productId: String(rolls._id) },
      });
      assert.equal(cheap.status, 200, cheap.text);
      const t = await model("Order").findById(third._id).lean();
      assert.equal(t.total, 600 + 250);
      assert.deepEqual(t.refunds.map((r) => [r.amount, r.provider, r.status]), [[300, "cod", "not_charged"]]);
    });

    it("a collection with age-restricted goods needs the ID check at the counter", async () => {
      await model("Product").updateOne({ _id: m.products.bread._id }, { $set: { minAge: 18 } });
      await model("Store").updateOne({ _id: m.stores.alpha._id }, { $set: { "fulfilment.collectionEnabled": true } });
      await add(m.products.bread._id, 1);
      await h.api("PUT", "/api/v1/cart/fulfilment", { token: m.token, body: { storeId: String(m.stores.alpha._id), method: "collection" } });
      const placed = await h.api("POST", "/api/v1/checkout", { token: m.token, body: { paymentMethod: "cod", ageConfirmed: true } });
      assert.equal(placed.status, 201, placed.text);
      const id = placed.body.data.orders[0].id;
      await status(id, "confirmed");
      await status(id, "ready_for_collection");
      assert.equal((await status(id, "collected")).status, 400);
      const ok = await status(id, "collected", { ageVerified: true, idType: "driving_licence" });
      assert.equal(ok.status, 200, ok.text);
      assert.equal((await model("Order").findById(id).lean()).delivery.proof.idType, "driving_licence");
    });

    it("live location: only the assigned rider, only while out for delivery, throttled", async () => {
      const rider = await addRider();
      await add(m.products.bread._id, 1);
      const order = await placeAlpha();
      await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${order._id}/rider`, { token: vendorA, body: { riderId: rider._id } });
      // eslint-disable-next-line global-require
      const { handleRiderLocation } = require(path.join(h.src, "lib", "riderLocation"));
      const sent = [];
      const io = { to: (rooms) => ({ emit: (event, payload) => sent.push({ rooms, event, payload }) }) };
      const call = (user, payload) => new Promise((resolve) => handleRiderLocation(io, { user }, payload, resolve));
      const riderUser = { id: String(rider._id), role: "rider" };

      assert.ok((await call(riderUser, { orderId: String(order._id), lat: 51.5, lng: -0.1 })).error, "not out for delivery yet");
      await status(order._id, "confirmed");
      await status(order._id, "packed");
      await status(order._id, "shipped");
      assert.ok((await call({ id: String(m.customer._id), role: "customer" }, { orderId: String(order._id), lat: 1, lng: 1 })).error);
      assert.ok((await call(riderUser, { orderId: String(order._id), lat: 999, lng: 0 })).error);
      assert.deepEqual(await call(riderUser, { orderId: String(order._id), lat: 51.5, lng: -0.1 }), { ok: true });
      assert.equal((await call(riderUser, { orderId: String(order._id), lat: 51.6, lng: -0.1 })).throttled, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].event, "order:rider_location");
      assert.ok(sent[0].rooms.includes(`user:${m.customer._id}`));
      const o = await model("Order").findById(order._id).lean();
      assert.equal(o.delivery.lastLocation.lat, 51.5);
    });
  });
};

module.exports = { runDeliveryScenarios };
