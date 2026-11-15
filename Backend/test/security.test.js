const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startHarness } = require("./helpers/harness");

describe("security", () => {
  let h;
  before(async () => {
    h = await startHarness({ replSet: false });
  });
  after(async () => {
    await h.stop();
  });
  beforeEach(async () => {
    await h.resetDb();
  });

  describe("security middleware", () => {
    it("sets helmet headers but lets other origins load uploads", async () => {
      const res = await h.api("GET", "/health");
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");
      assert.equal(res.headers.get("x-powered-by"), null);
    });

    it("throttles repeated OTP requests for one email, not other emails", async () => {
      const hit = (email) =>
        h.api("POST", "/api/v1/auth/forgot-password", { body: { email } });
      const statuses = [];
      for (let i = 0; i < 11; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        statuses.push((await hit("victim@example.test")).status);
      }
      assert.ok(statuses.slice(0, 10).every((s) => s !== 429), statuses.join(","));
      assert.equal(statuses[10], 429);
      const other = await hit("someone-else@example.test");
      assert.notEqual(other.status, 429);
    });

    it("never throttles token refresh", async () => {
      for (let i = 0; i < 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const r = await h.api("POST", "/api/v1/auth/refresh", { body: {} });
        assert.notEqual(r.status, 429);
        assert.equal(r.headers.get("ratelimit"), null);
      }
    });
  });

});
