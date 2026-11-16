/**
 * Wave 3 end-to-end: earning, spending, restoring and expiring points, and
 * referrals, through the real API.
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { startHarness } = require("./harness");
const { model, makeUser, tokenFor, seedMarketplace, fillStandardCart, checkoutBody } = require("./fixtures");

const runLoyaltyScenarios = ({ replSet }) => {
  describe(`rewards and referrals end to end (${replSet ? "transaction" : "compensation"} path)`, () => {
    let h;
    let m;
    let admin;
    let vendorA;
    let lib;

    before(async () => {
      h = await startHarness({ replSet });
      // eslint-disable-next-line global-require
      lib = require(path.join(h.src, "lib", "loyalty"));
    });
    after(async () => {
      await h.stop();
    });
    beforeEach(async () => {
      await h.resetDb();
      m = await seedMarketplace();
      admin = tokenFor(await makeUser({ role: "admin" }));
      vendorA = tokenFor(await model("User").findOne({ storeId: m.stores.alpha._id }));
      const on = await h.api("PATCH", "/api/v1/admin/settings", {
        token: admin,
        body: { loyalty: { enabled: true, referral: { enabled: true } } },
      });
      assert.equal(on.status, 200, on.text);
      // Alpha takes part (through its own settings form), Bravo doesn't
      const opt = await h.api("PATCH", "/api/v1/vendor/dashboard/settings", { token: vendorA, body: { loyaltyOptIn: "true" } });
      assert.equal(opt.status, 200, opt.text);
    });

    const grant = (user, points) =>
      h.api("POST", "/api/v1/admin/loyalty/adjust", { token: admin, body: { userId: String(user._id), points, note: "Test credit" } });
    const balanceOf = async (user) => (await model("LoyaltyAccount").findOne({ user: user._id }).lean())?.balance || 0;
    const ledgerSum = async (user) =>
      (await model("LoyaltyLedger").find({ user: user._id }).lean()).reduce((a, e) => a + e.points, 0);
    const deliver = async (orderId, token = vendorA) => {
      for (const s of ["confirmed", "packed", "shipped", "delivered"]) {
        // eslint-disable-next-line no-await-in-loop
        const r = await h.api("PATCH", `/api/v1/vendor/dashboard/orders/${orderId}/status`, { token, body: { orderStatus: s } });
        assert.equal(r.status, 200, r.text);
      }
    };

    it("earns on delivery at taking-part stores only, once", async () => {
      await fillStandardCart(h, m);
      const placed = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      const orders = await model("Order").find({ customer: m.customer._id });
      const alpha = orders.find((o) => String(o.store) === String(m.stores.alpha._id));
      assert.equal(placed.status, 201);
      assert.equal(await balanceOf(m.customer), 0, "nothing on placing or paying");

      await deliver(alpha._id);
      assert.equal(await balanceOf(m.customer), 17, "£17.99 of goods = 17 points");
      const order = await model("Order").findById(alpha._id).lean();
      assert.equal(order.loyalty.pointsEarned, 17);

      // running the hook again never pays twice
      // eslint-disable-next-line global-require
      const { onOrderCompleted } = require(path.join(h.src, "lib", "paymentService"));
      await onOrderCompleted(order);
      assert.equal(await balanceOf(m.customer), 17);

      const vendorB = tokenFor(await model("User").findOne({ storeId: m.stores.bravo._id }));
      const bravo = orders.find((o) => String(o.store) === String(m.stores.bravo._id));
      await deliver(bravo._id, vendorB);
      assert.equal(await balanceOf(m.customer), 17, "Bravo doesn't take part");
      assert.equal(await ledgerSum(m.customer), 17);
    });

    it("spends points at checkout, platform-funded, and gives them back on cancel", async () => {
      assert.equal((await grant(m.customer, 500)).status, 201);
      await fillStandardCart(h, m);
      const use = await h.api("PUT", "/api/v1/cart/loyalty", { token: m.token, body: { points: 300 } });
      assert.equal(use.status, 200, use.text);
      assert.equal(use.body.data.loyalty.appliedPoints, 300);
      assert.equal(use.body.data.grandTotal, 3348 - 300);
      const bravoGroup = use.body.data.byStore.find((g) => String(g.storeId) === String(m.stores.bravo._id));
      assert.equal(bravoGroup.lines.length, 0, "points only reduce taking-part stores");

      const placed = await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody({ paymentMethod: "online", clientType: "mobile" }) });
      assert.equal(placed.status, 201, placed.text);
      assert.equal(h.stripeCalls.find((c) => c.api === "paymentIntents.create").args.amount, 3048);
      assert.equal(await balanceOf(m.customer), 200);
      const alpha = await model("Order").findOne({ store: m.stores.alpha._id }).lean();
      assert.equal(alpha.loyalty.pointsRedeemed, 300);
      assert.deepEqual(alpha.priceLines.map((l) => [l.kind, l.amount, l.fundedBy]), [["loyalty", -300, "platform"]]);
      assert.equal((await model("Cart").findOne({ user: m.customer._id }).lean()).loyaltyPoints, 0);

      // eslint-disable-next-line global-require
      const { markOrdersPaid } = require(path.join(h.src, "lib", "paymentService"));
      await markOrdersPaid({ orderIds: [alpha._id], provider: "stripe" });
      const paid = await model("Order").findById(alpha._id).lean();
      assert.equal(paid.commission.base, 2049, "points don't touch the store's commission base");
      assert.equal(paid.commission.vendorNet, 2049 - 204.9);

      const cancel = await h.api("POST", `/api/v1/customer/orders/${alpha._id}/cancel`, { token: m.token, body: {} });
      assert.equal(cancel.status, 200, cancel.text);
      assert.equal(await balanceOf(m.customer), 500);
      assert.equal(await ledgerSum(m.customer), 500);
    });

    it("never spends points that aren't there", async () => {
      await grant(m.customer, 200);
      await assert.rejects(
        lib.postEntry({ user: m.customer._id, type: "redeem", points: -300, key: "redeem:test" }),
        /enough points/
      );
      assert.equal(await balanceOf(m.customer), 200);
      assert.equal(await ledgerSum(m.customer), 200);
    });

    it("expires only unspent points past their date, once", async () => {
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await lib.postEntry({ user: m.customer._id, type: "earn", points: 300, key: "earn:old", expiresAt: old });
      await lib.postEntry({ user: m.customer._id, type: "earn", points: 200, key: "earn:new", expiresAt: lib.addMonths(new Date(), 12) });
      await lib.postEntry({ user: m.customer._id, type: "redeem", points: -100, key: "redeem:some" });
      // oldest first: 100 of the 300 old points were spent, 200 of them expire
      assert.equal(await lib.syncExpiry(m.customer._id), 200);
      assert.equal(await lib.syncExpiry(m.customer._id), 0);
      assert.equal(await balanceOf(m.customer), 200);
      assert.equal(await ledgerSum(m.customer), 200);

      const rewards = await h.api("GET", "/api/v1/me/rewards", { token: m.token });
      assert.equal(rewards.status, 200, rewards.text);
      assert.equal(rewards.body.data.balance, 200);
      assert.equal(rewards.body.data.value, 200);
      assert.deepEqual(rewards.body.data.history.map((x) => x.type), ["expire", "redeem", "earn", "earn"]);
    });

    it("referral: friend gets a one-person welcome code, referrer is paid once on the friend's first delivery", async () => {
      const mine = await h.api("GET", "/api/v1/me/rewards", { token: m.token });
      const code = mine.body.data.referral.code;
      assert.match(code, /^[A-Z2-9]{7}$/);

      const bad = await h.api("POST", "/api/v1/auth/register", {
        body: { name: "Friend", email: "friend@example.test", password: "Passw0rdX", referralCode: "NOPE123" },
      });
      assert.equal(bad.status, 400);
      assert.equal(await model("User").countDocuments({ email: "friend@example.test" }), 0);

      const reg = await h.api("POST", "/api/v1/auth/register", {
        body: { name: "Friend", email: "friend@example.test", password: "Passw0rdX", referralCode: code.toLowerCase() },
      });
      assert.equal(reg.status, 201, reg.text);
      const otp = await model("Otp").findOne({ email: "friend@example.test" }).lean();
      const verified = await h.api("POST", "/api/v1/auth/verify-signup", { body: { email: "friend@example.test", otp: otp.otp } });
      assert.equal(verified.status, 200, verified.text);

      const friend = await model("User").findOne({ email: "friend@example.test" });
      const friendToken = tokenFor(friend);
      const referral = await model("Referral").findOne({ referee: friend._id }).lean();
      assert.equal(referral.status, "pending");
      const welcome = await model("Coupon").findOne({ code: referral.couponCode }).lean();
      assert.equal(String(welcome.allowedUser), String(friend._id));
      assert.equal(welcome.fundedBy, "platform");

      // Someone else can't use the friend's code
      await fillStandardCart(h, m);
      const stolen = await h.api("POST", "/api/v1/cart/coupon", { token: m.token, body: { code: referral.couponCode } });
      assert.equal(stolen.status, 409);
      assert.match(stolen.body.message, /another account/);

      // The friend's basket already holds it
      await fillStandardCart(h, { ...m, token: friendToken });
      const cart = await h.api("GET", "/api/v1/cart", { token: friendToken });
      assert.equal(cart.body.data.coupons[0].status, "applied");
      const placed = await h.api("POST", "/api/v1/checkout", { token: friendToken, body: checkoutBody() });
      assert.equal(placed.status, 201, placed.text);
      const alpha = await model("Order").findOne({ customer: friend._id, store: m.stores.alpha._id });
      await deliver(alpha._id);

      const paid = await model("Referral").findOne({ referee: friend._id }).lean();
      assert.equal(paid.status, "rewarded");
      assert.equal(await balanceOf(m.customer), 500);
      assert.ok(await balanceOf(friend) > 0, "the friend earns their own points too");

      // A later delivery for the friend doesn't pay the referrer again
      const vendorB = tokenFor(await model("User").findOne({ storeId: m.stores.bravo._id }));
      const bravo = await model("Order").findOne({ customer: friend._id, store: m.stores.bravo._id });
      await deliver(bravo._id, vendorB);
      assert.equal(await balanceOf(m.customer), 500);
    });

    it("a referral that looks like the same person is held for an admin", async () => {
      await model("User").updateOne({ _id: m.customer._id }, { $set: { phone: "07700 900123" } });
      const code = (await h.api("GET", "/api/v1/me/rewards", { token: m.token })).body.data.referral.code;
      await h.api("POST", "/api/v1/auth/register", {
        body: { name: "Alt", email: "alt@example.test", password: "Passw0rdX", referralCode: code },
      });
      const alt = await model("User").findOneAndUpdate(
        { email: "alt@example.test" },
        { $set: { status: "active", phone: "07700900123" } },
        { new: true }
      );
      const altToken = tokenFor(alt);
      await h.api("POST", "/api/v1/cart/items", { token: altToken, body: { productId: String(m.products.bread._id), quantity: 4 } });
      const placed = await h.api("POST", "/api/v1/checkout", { token: altToken, body: checkoutBody() });
      assert.equal(placed.status, 201, placed.text);
      await deliver(placed.body.data.orders[0].id);

      const held = await model("Referral").findOne({ referee: alt._id }).lean();
      assert.equal(held.status, "review");
      assert.deepEqual(held.flags, ["same_phone"]);
      assert.equal(await balanceOf(m.customer), 0);

      const list = await h.api("GET", "/api/v1/admin/referrals?status=review", { token: admin });
      assert.equal(list.body.data.length, 1);
      const approve = await h.api("PATCH", `/api/v1/admin/referrals/${held._id}`, { token: admin, body: { action: "approve", note: "Same household, genuine" } });
      assert.equal(approve.status, 200, approve.text);
      assert.equal(await balanceOf(m.customer), 500);
      const again = await h.api("PATCH", `/api/v1/admin/referrals/${held._id}`, { token: admin, body: { action: "approve" } });
      assert.equal(again.status, 409);
    });

    it("admin sees the ledger and what unspent points would cost", async () => {
      await grant(m.customer, 250);
      const other = await makeUser();
      await grant(other, 50);
      const res = await h.api("GET", `/api/v1/admin/loyalty/ledger?email=${encodeURIComponent(m.customer.email)}`, { token: admin });
      assert.equal(res.status, 200, res.text);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].note, "Test credit");
      assert.deepEqual(res.body.outstanding, { points: 300, value: 300, accounts: 2 });
      const bad = await h.api("POST", "/api/v1/admin/loyalty/adjust", { token: admin, body: { userId: String(other._id), points: 10, note: "" } });
      assert.equal(bad.status, 400);
    });
  });
};

module.exports = { runLoyaltyScenarios };
