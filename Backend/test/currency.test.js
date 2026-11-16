const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startHarness } = require("./helpers/harness");
const { model, seedMarketplace, fillStandardCart, checkoutBody } = require("./helpers/fixtures");

describe("currency and stored pricing", () => {
  let h;
  before(async () => {
    h = await startHarness({ replSet: true });
  });
  after(async () => {
    await h.stop();
  });
  beforeEach(async () => {
    await h.resetDb();
  });

  describe("currency", () => {
    it("new platforms default to gbp", async () => {
      const s = await model("PlatformSettings").getOrInit();
      assert.equal(s.currency, "gbp");
    });

    it("a stale 'usd' default is replaced once by the legacy PLATFORM_CURRENCY", async () => {
      const PlatformSettings = model("PlatformSettings");
      await PlatformSettings.collection.insertOne({ key: "platform", currency: "usd" });
      let s = await PlatformSettings.getOrInit();
      assert.equal(s.currency, "gbp");
      assert.ok(s.migrations.currencyFromEnvAt);

      // After the one-off copy an admin's explicit choice sticks
      s.currency = "usd";
      await s.save();
      s = await PlatformSettings.getOrInit();
      assert.equal(s.currency, "usd");
    });

    it("Stripe and the payment transaction charge in the settings currency", async () => {
      const m = await seedMarketplace();
      const PlatformSettings = model("PlatformSettings");
      const s = await PlatformSettings.getOrInit();
      s.currency = "eur";
      await s.save();
      await fillStandardCart(h, m);
      const res = await h.api("POST", "/api/v1/checkout", {
        token: m.token,
        body: checkoutBody({ paymentMethod: "online", clientType: "mobile" }),
      });
      assert.equal(res.status, 201, res.text);
      assert.equal(res.body.data.payment.currency, "eur");
      assert.equal(h.stripeCalls.find((c) => c.api === "paymentIntents.create").args.currency, "eur");
    });
  });

  describe("orders store their pricing breakdown", () => {
    it("placed orders carry empty price lines and zero adjustment totals", async () => {
      const m = await seedMarketplace();
      await fillStandardCart(h, m);
      await h.api("POST", "/api/v1/checkout", { token: m.token, body: checkoutBody() });
      const orders = await model("Order").find({ customer: m.customer._id }).lean();
      for (const o of orders) {
        assert.deepEqual(o.priceLines, []);
        assert.equal(o.discountTotal, 0);
        assert.equal(o.feeTotal, 0);
        assert.equal(o.tipAmount, 0);
        assert.equal(o.total, o.subtotal + o.shippingFee);
      }
    });
  });
});
