/**
 * Wave 5: account deletion, version gate, banners, saved cards, postcode
 * lookup switch.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { startHarness } = require("./helpers/harness");
const { model, makeUser, tokenFor, seedMarketplace, checkoutBody } = require("./helpers/fixtures");

describe("store readiness", () => {
  let h;
  let m;
  let admin;

  before(async () => {
    h = await startHarness({ replSet: false });
  });
  after(async () => {
    await h.stop();
  });
  beforeEach(async () => {
    await h.resetDb();
    m = await seedMarketplace();
    admin = tokenFor(await makeUser({ role: "admin" }));
  });

  describe("version gate", () => {
    it("says none / soft / required against the admin's versions", async () => {
      const bad = await h.api("PATCH", "/api/v1/admin/settings", { token: admin, body: { app: { minVersion: "one" } } });
      assert.equal(bad.status, 400);
      const set = await h.api("PATCH", "/api/v1/admin/settings", {
        token: admin,
        body: { app: { minVersion: "1.2.0", latestVersion: "1.4.1", androidUrl: "https://play.google.com/store/apps/details?id=com.ukmarketplace.app", message: "New checkout" } },
      });
      assert.equal(set.status, 200, set.text);
      const ask = async (v) => (await h.api("GET", `/api/v1/app/config?platform=android&version=${v}`)).body.data;
      assert.equal((await ask("1.1.9")).update, "required");
      assert.equal((await ask("1.2.0")).update, "soft");
      assert.equal((await ask("1.10.0")).update, "none", "compares numbers, not text");
      const cfg = await ask("1.3");
      assert.equal(cfg.update, "soft");
      assert.match(cfg.storeUrl, /play\.google/);
      assert.deepEqual(Object.keys(cfg.features).sort(), ["addressLookup", "cardPayments", "cashOnDelivery", "rewards"]);
      assert.equal(cfg.features.addressLookup, false, "no postcode provider configured");
    });
  });

  describe("banners", () => {
    it("admins create them; customers see only live ones, and area ones only nearby", async () => {
      const mk = (body) => h.api("POST", "/api/v1/admin/banners", { token: admin, body });
      assert.equal((await mk({ title: "x" })).status, 400);
      assert.equal((await mk({ title: "Bad link", targetType: "url", targetValue: "http://example.com" })).status, 400);
      assert.equal((await mk({ title: "Half area", lat: 51.5 })).status, 400);
      assert.equal((await mk({ title: "Everywhere", targetType: "coupon", targetValue: "WELCOME5", sortOrder: 2 })).status, 201);
      assert.equal((await mk({ title: "London only", lat: 51.5074, lng: -0.1278, radiusKm: 10, sortOrder: 1 })).status, 201);
      assert.equal((await mk({ title: "Over", endsAt: new Date(Date.now() - 1000).toISOString(), startsAt: new Date(Date.now() - 5000).toISOString() })).status, 201);
      assert.equal((await mk({ title: "Off", isActive: "false" })).status, 201);

      const titles = async (q = "") => (await h.api("GET", `/api/v1/banners${q}`)).body.data.map((b) => b.title);
      assert.deepEqual(await titles(), ["Everywhere"]);
      assert.deepEqual(await titles("?lat=51.52&lng=-0.10"), ["London only", "Everywhere"]);
      assert.deepEqual(await titles("?lat=53.48&lng=-2.24"), ["Everywhere"], "Manchester is outside the London area");
    });
  });

  describe("account deletion", () => {
    const code = async (user) => {
      // eslint-disable-next-line global-require
      const { requestDeletion } = require(path.join(h.src, "lib", "accountDeletion"));
      let sent = "";
      return requestDeletion(await model("User").findById(user._id), { sendEmail: async ({ body }) => { sent = body; } })
        .then((c) => { assert.match(sent, new RegExp(c)); return c; });
    };

    it("removes personal data, keeps orders for the books, frees the email", async () => {
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.bread._id), quantity: 1 } });
      const placed = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      const orderId = placed.body.data.orders[0].id;

      const blocked = await h.api("POST", "/api/v1/me/account/delete-code", { token: m.token, body: {} });
      assert.equal(blocked.status, 409, "an order is still in progress");
      await h.api("POST", `/api/v1/customer/orders/${orderId}/cancel`, { token: m.token, body: {} });

      const asked = await h.api("POST", "/api/v1/me/account/delete-code", { token: m.token, body: {} });
      assert.equal(asked.status, 200, asked.text);
      const otp = await model("Otp").findOne({ purpose: "delete_account" }).lean();
      assert.notEqual(otp.otp.length, 6, "the code is stored hashed");

      // eslint-disable-next-line global-require
      const loyalty = require(path.join(h.src, "lib", "loyalty"));
      await loyalty.postEntry({ user: m.customer._id, type: "adjust", points: 120, key: "gift", note: "gift" });
      await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.bread._id), quantity: 1 } });

      const real = await code(m.customer);
      assert.equal((await h.api("POST", "/api/v1/me/account/delete", { token: m.token, body: { code: "000000" } })).status, 400);
      const done = await h.api("POST", "/api/v1/me/account/delete", { token: m.token, body: { code: real } });
      assert.equal(done.status, 200, done.text);

      const user = await model("User").findById(m.customer._id).lean();
      assert.equal(user.status, "deleted");
      assert.equal(user.name, "Deleted user");
      assert.match(user.email, /@deleted\.invalid$/);
      assert.deepEqual(user.addresses, []);
      const order = await model("Order").findById(orderId).lean();
      assert.equal(order.total, 450 + 250, "amounts kept");
      assert.equal(order.customerSnapshot.email, "");
      assert.equal(order.shippingAddress.line1, "");
      assert.equal(await model("Cart").countDocuments({ user: m.customer._id }), 0);
      assert.equal((await model("LoyaltyAccount").findOne({ user: m.customer._id }).lean()).balance, 0);
      const ledger = await model("LoyaltyLedger").find({ user: m.customer._id }).lean();
      assert.equal(ledger.reduce((a, e) => a + e.points, 0), 0, "forfeited through the ledger");

      assert.equal((await h.api("GET", "/api/v1/cart", { token: m.token })).status, 403, "old sessions stop working");
      const again = await h.api("POST", "/api/v1/auth/register", {
        body: { name: "Back again", email: m.customer.email, password: "Passw0rdX" },
      });
      assert.equal(again.status, 201, "the email can be used for a new account");
    });

    it("shop owners can't delete themselves from the app", async () => {
      const vendor = tokenFor(await model("User").findOne({ storeId: m.stores.alpha._id }));
      const res = await h.api("POST", "/api/v1/me/account/delete-code", { token: vendor, body: {} });
      assert.equal(res.status, 409);
      assert.match(res.body.message, /support/);
    });
  });

  describe("saved cards", () => {
    it("one Stripe customer per shopper, ephemeral key for PaymentSheet, cards only removable by their owner", async () => {
      for (let i = 0; i < 2; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await h.api("POST", "/api/v1/cart/items", { token: m.token, body: { productId: String(m.products.bread._id), quantity: 1 } });
        // eslint-disable-next-line no-await-in-loop
        const res = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody({ paymentMethod: "online", clientType: "mobile" }) });
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.data.payment.customerId, "cus_test_1");
        assert.equal(res.body.data.payment.customerEphemeralKeySecret, "ek_test_cus_test_1");
      }
      assert.equal(h.stripeCalls.filter((c) => c.api === "customers.create").length, 1);
      const pis = h.stripeCalls.filter((c) => c.api === "paymentIntents.create");
      assert.ok(pis.every((c) => c.args.customer === "cus_test_1"));

      const cards = await h.api("GET", "/api/v1/me/payment-methods", { token: m.token });
      assert.deepEqual(cards.body.data.map((c) => `${c.brand} ${c.last4}`), ["visa 4242"]);
      assert.equal((await h.api("DELETE", "/api/v1/me/payment-methods/pm_someone_else", { token: m.token })).status, 404);
      assert.equal((await h.api("DELETE", "/api/v1/me/payment-methods/pm_test_1", { token: m.token })).status, 200);
    });
  });

  describe("postcode lookup", () => {
    it("is off without a provider, so the app shows the manual form", async () => {
      const res = await h.api("GET", "/api/v1/address/lookup?postcode=E16AN", { token: m.token });
      assert.deepEqual(res.body.data, { enabled: false, addresses: [] });
      // eslint-disable-next-line global-require
      const { normalisePostcode, POSTCODE_RE } = require(path.join(h.src, "lib", "postcode"));
      assert.equal(normalisePostcode("sw1a1aa"), "SW1A 1AA");
      assert.ok(POSTCODE_RE.test("EC1A 1BB"));
      assert.ok(!POSTCODE_RE.test("12345"));
    });
  });
});
