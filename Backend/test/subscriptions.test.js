/**
 * Pure: repeat-order dates.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("./helpers/harness");
const { firstRunOn, advance, upcoming } = require("../src/lib/subscriptions");

describe("repeat order dates", () => {
  it("weekly and fortnightly land on the chosen weekday", () => {
    const week = { every: "week", weekday: 5 }; // Friday
    assert.equal(firstRunOn("2026-11-16", week), "2026-11-20"); // Mon -> Fri
    assert.equal(firstRunOn("2026-11-20", week), "2026-11-20", "on or after");
    assert.equal(advance("2026-11-20", week), "2026-11-27");
    assert.equal(advance("2026-11-20", { every: "fortnight", weekday: 5 }), "2026-12-04");
  });

  it("monthly keeps the day (1-28) across short months and years", () => {
    const month = { every: "month", dayOfMonth: 28 };
    assert.equal(firstRunOn("2026-11-29", month), "2026-12-28");
    assert.equal(advance("2026-12-28", month), "2027-01-28");
    assert.equal(advance("2027-01-28", month), "2027-02-28");
  });

  it("upcoming leaves skipped dates out", () => {
    const sub = { nextRunOn: "2026-11-20", cadence: { every: "week", weekday: 5 }, skipDates: ["2026-11-27"] };
    assert.deepEqual(upcoming(sub, 3), ["2026-11-20", "2026-12-04", "2026-12-11"]);
  });
});
