/**
 * Wave 2 end-to-end: collection, time slots, capacity, arrival, and the
 * collection status path, through the real API.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startHarness } = require("./harness");
const { model, makeUser, tokenFor, seedMarketplace, checkoutBody } = require("./fixtures");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const londonWeekday = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(new Date()).toLowerCase();

const openEveryDay = (overrides = {}) =>
  Object.fromEntries(DAYS.map((d) => [d, { open: "08:00", close: "20:00", isClosed: false, ...(overrides[d] || {}) }]));

const runFulfilmentScenarios = ({ replSet }) => {
  describe(`collection and time slots end to end (${replSet ? "transaction" : "compensation"} path)`, () => {
    let h;
    let m;
    let vendorA;
    let slug;

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
      slug = m.stores.alpha.slug;
      await model("Store").updateOne(
        { _id: m.stores.alpha._id },
        {
          $set: {
            timezone: "Europe/London",
            operatingHours: openEveryDay(),
            fulfilment: { deliveryEnabled: true, collectionEnabled: true, slotLengthMins: 60, leadTimeMins: 60, maxOrdersPerSlot: 1, daysAhead: 3 },
          },
        }
      );
    });

    const addBread = (token = m.token, quantity = 2) =>
      h.api("POST", "/api/v1/cart/items", { token, body: { productId: String(m.products.bread._id), quantity } });
    const choose = (body, token = m.token) =>
      h.api("PUT", "/api/v1/cart/fulfilment", { token, body: { storeId: String(m.stores.alpha._id), ...body } });
    const tomorrowSlot = async (method = "delivery") => {
      const res = await h.api("GET", `/api/v1/stores/${slug}/slots?method=${method}`);
      assert.equal(res.status, 200, res.text);
      return res.body.data.days[1].slots.find((s) => s.available);
    };
    const place = (body = {}, token = m.token) => h.api("POST", "/api/v1/checkout", { token, body });
    const setStatus = (orderId, orderStatus) =>
      h.api("PATCH", `/api/v1/vendor/dashboard/orders/${orderId}/status`, { token: vendorA, body: { orderStatus } });

    it("lists slots for the store's offered days in its timezone", async () => {
      const res = await h.api("GET", `/api/v1/stores/${slug}/slots?method=collection`);
      const d = res.body.data;
      assert.equal(d.method, "collection");
      assert.equal(d.timezone, "Europe/London");
      assert.equal(d.days.length, 3);
      assert.deepEqual(d.days.slice(0, 2).map((x) => x.label), ["Today", "Tomorrow"]);
      assert.equal(d.days[1].slots.length, 12, "08:00-20:00 in hours");
      assert.equal(d.days[1].slots[0].label, "08:00–09:00");
      assert.equal(d.days[1].slots[0].remaining, 1);

      const off = await h.api("GET", `/api/v1/stores/${m.stores.bravo.slug}/slots?method=collection`);
      assert.equal(off.body.data.methodEnabled, false);
      assert.deepEqual(off.body.data.days, []);
    });

    it("collection: no delivery charge, no address, store's own status path, COD paid on handover", async () => {
      await addBread();
      const bravoCollect = await h.api("PUT", "/api/v1/cart/fulfilment", {
        token: m.token,
        body: { storeId: String(m.stores.bravo._id), method: "collection" },
      });
      assert.equal(bravoCollect.status, 400, "Bravo isn't in the basket");

      const res = await choose({ method: "collection", slotStart: null });
      assert.equal(res.status, 200, res.text);
      const group = res.body.data.byStore[0];
      assert.equal(group.fulfilment.method, "collection");
      assert.equal(group.shippingFee, 0);
      assert.equal(group.total, 900);

      const placed = await place({ paymentMethod: "cod" });
      assert.equal(placed.status, 201, placed.text);
      const orderId = placed.body.data.orders[0].id;
      const order = await model("Order").findById(orderId).lean();
      assert.equal(order.fulfilment.method, "collection");
      assert.equal(order.fulfilment.asap, true);
      assert.equal(order.shippingFee, 0);
      assert.equal(order.shippingMethod.code, "");

      assert.equal((await setStatus(orderId, "confirmed")).status, 200);
      assert.equal((await setStatus(orderId, "shipped")).status, 400, "collections aren't shipped");
      assert.equal((await setStatus(orderId, "ready_for_collection")).status, 200);
      const done = await setStatus(orderId, "collected");
      assert.equal(done.status, 200, done.text);
      const final = await model("Order").findById(orderId).lean();
      assert.ok(final.fulfilment.readyAt && final.fulfilment.collectedAt);
      assert.equal(final.paymentStatus, "paid");
      assert.equal(final.commission.amount, 90);
    });

    it("a delivery order can't be marked ready for collection", async () => {
      await addBread();
      const placed = await place(checkoutBody());
      const orderId = placed.body.data.orders[0].id;
      await setStatus(orderId, "confirmed");
      assert.equal((await setStatus(orderId, "ready_for_collection")).status, 400);
    });

    it("rejects a method the store doesn't offer and a slot it doesn't have", async () => {
      await model("Store").updateOne({ _id: m.stores.alpha._id }, { $set: { "fulfilment.collectionEnabled": false } });
      await addBread();
      const res = await choose({ method: "collection" });
      assert.equal(res.status, 409);
      assert.match(res.body.message, /doesn't offer collection/);
      const odd = await choose({ method: "delivery", slotStart: "2026-01-01T09:13:00.000Z" });
      assert.equal(odd.status, 409);
    });

    it("a booked slot is stored on the order; the last place goes to whoever checks out first", async () => {
      const slot = await tomorrowSlot();
      const other = await makeUser();
      const otherToken = tokenFor(other);
      await addBread();
      await addBread(otherToken, 1);
      assert.equal((await choose({ method: "delivery", slotStart: slot.start })).status, 200);
      assert.equal((await choose({ method: "delivery", slotStart: slot.start }, otherToken)).status, 200);

      const first = await place(checkoutBody());
      assert.equal(first.status, 201, first.text);
      const order = await model("Order").findById(first.body.data.orders[0].id).lean();
      assert.equal(order.fulfilment.asap, false);
      assert.equal(new Date(order.fulfilment.slotStart).toISOString(), slot.start);
      assert.equal(new Date(order.fulfilment.slotEnd).toISOString(), slot.end);

      const second = await place(checkoutBody(), otherToken);
      assert.equal(second.status, 409, second.text);
      assert.match(second.body.message, /full/);
      assert.equal(await model("Order").countDocuments({ customer: other._id }), 0);
      assert.equal((await model("Product").findById(m.products.bread._id).lean()).stock, 10 - 2, "loser's stock went back");

      const after = await h.api("GET", `/api/v1/stores/${slug}/slots`);
      const same = after.body.data.days[1].slots.find((s) => s.start === slot.start);
      assert.equal(same.available, false);

      // cancelling gives the place back
      await h.api("POST", `/api/v1/customer/orders/${first.body.data.orders[0].id}/cancel`, { token: m.token, body: {} });
      const booking = await model("SlotBooking").findOne({}).lean();
      assert.equal(booking.count, 0);
      assert.equal((await place(checkoutBody(), otherToken)).status, 201);
    });

    it("a store closed today still takes orders for a later slot, but not ASAP", async () => {
      await model("Store").updateOne(
        { _id: m.stores.alpha._id },
        { $set: { operatingHours: openEveryDay({ [londonWeekday()]: { isClosed: true } }) } }
      );
      await addBread();
      const asap = await place(checkoutBody());
      assert.equal(asap.status, 409);
      assert.match(asap.body.message, /closed/);

      const slot = await tomorrowSlot();
      assert.equal((await choose({ method: "delivery", slotStart: slot.start })).status, 200);
      assert.equal((await place(checkoutBody())).status, 201);
    });

    it("the delivery-zone check doesn't apply to collection", async () => {
      await model("Store").updateOne(
        { _id: m.stores.alpha._id },
        { $set: { locationSet: true, location: { type: "Point", coordinates: [-2.24, 53.48] }, deliveryRadiusKm: 5 } }
      );
      await addBread();
      const far = await place(checkoutBody()); // London address, Manchester store
      assert.equal(far.status, 409);
      await choose({ method: "collection" });
      assert.equal((await place(checkoutBody())).status, 201);
    });

    it("\"I've arrived\" works once the store has accepted a collection", async () => {
      await addBread();
      await choose({ method: "collection" });
      const placed = await place({ paymentMethod: "cod" });
      const orderId = placed.body.data.orders[0].id;
      const arrive = (body = {}) => h.api("POST", `/api/v1/customer/orders/${orderId}/arrived`, { token: m.token, body });

      assert.equal((await arrive()).status, 409, "not accepted yet");
      await setStatus(orderId, "confirmed");
      const ok = await arrive({ note: "Blue car, bay 3" });
      assert.equal(ok.status, 200, ok.text);
      const order = await model("Order").findById(orderId).lean();
      assert.ok(order.fulfilment.arrivedAt);
      assert.equal(order.fulfilment.arrivalNote, "Blue car, bay 3");

      const stranger = tokenFor(await makeUser());
      assert.equal((await h.api("POST", `/api/v1/customer/orders/${orderId}/arrived`, { token: stranger, body: {} })).status, 404);
    });

    it("vendors manage fulfilment settings and can sort orders by slot", async () => {
      const get = await h.api("GET", "/api/v1/vendor/dashboard/fulfilment", { token: vendorA });
      assert.equal(get.body.data.daysAhead, 3);
      assert.equal(get.body.data.hasHours, true);
      const bad = await h.api("PATCH", "/api/v1/vendor/dashboard/fulfilment", {
        token: vendorA,
        body: { deliveryEnabled: false, collectionEnabled: false },
      });
      assert.equal(bad.status, 400);
      const ok = await h.api("PATCH", "/api/v1/vendor/dashboard/fulfilment", {
        token: vendorA,
        body: { slotLengthMins: 30, collectionInstructions: "Ring the bell at the side door" },
      });
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.body.data.slotLengthMins, 30);
      assert.equal(ok.body.data.daysAhead, 3, "untouched fields stay");

      await addBread();
      await choose({ method: "collection" });
      await place({ paymentMethod: "cod" });
      const list = await h.api("GET", "/api/v1/vendor/dashboard/orders?sort=slot&method=collection", { token: vendorA });
      assert.equal(list.status, 200, list.text);
      assert.equal(list.body.data[0].fulfilment.method, "collection");
      const deliveries = await h.api("GET", "/api/v1/vendor/dashboard/orders?method=delivery", { token: vendorA });
      assert.equal(deliveries.body.data.length, 0);
    });
  });
};

module.exports = { runFulfilmentScenarios };
