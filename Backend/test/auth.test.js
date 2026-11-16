/**
 * Sign-up and password-reset codes are stored hashed and still work.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startHarness } = require("./helpers/harness");
const { model } = require("./helpers/fixtures");

const hash = (c) => crypto.createHash("sha256").update(c).digest("hex");

describe("one-time codes", () => {
  let h;
  before(async () => { h = await startHarness({ replSet: false }); });
  after(async () => { await h.stop(); });

  it("are never stored as typed, and verify by hash", async () => {
    const email = "codes@example.test";
    assert.equal((await h.api("POST", "/api/v1/auth/register", { body: { name: "Codes", email, password: "Passw0rdX" } })).status, 201);
    const signup = await model("Otp").findOne({ email, purpose: "signup" }).lean();
    assert.match(signup.otp, /^[a-f0-9]{64}$/);
    await model("Otp").updateOne({ _id: signup._id }, { $set: { otp: hash("111111") } });
    assert.equal((await h.api("POST", "/api/v1/auth/verify-signup", { body: { email, otp: "999999" } })).status, 400);
    assert.equal((await h.api("POST", "/api/v1/auth/verify-signup", { body: { email, otp: "111111" } })).status, 200);

    assert.equal((await h.api("POST", "/api/v1/auth/forgot-password", { body: { email } })).status, 200);
    const reset = await model("Otp").findOne({ email, purpose: "reset_password" }).lean();
    assert.match(reset.otp, /^[a-f0-9]{64}$/);
    await model("Otp").updateOne({ _id: reset._id }, { $set: { otp: hash("222222") } });
    assert.equal((await h.api("POST", "/api/v1/auth/verify-reset-otp", { body: { email, otp: "222222" } })).status, 200);
    const done = await h.api("POST", "/api/v1/auth/reset-password", { body: { email, otp: "222222", newPassword: "NewPassw0rd" } });
    assert.equal(done.status, 200, done.text);
    assert.equal((await h.api("POST", "/api/v1/auth/login", { body: { email, password: "NewPassw0rd" } })).status, 200);
  });
});
