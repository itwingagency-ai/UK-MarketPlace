/**
 * Pure tests for lib/slots: timezone maths, slot generation, capacity, and
 * collection pricing. No database.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("./helpers/harness"); // env vars so lib modules load
const { zonedToUtc, slotsForDate, findSlot, localDate, dayLabel } = require("../src/lib/slots");
const { priceStoreGroup } = require("../src/lib/pricing");
const { priceCart } = require("../src/lib/offers");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const everyDay = (open, close) => new Map(DAYS.map((d) => [d, { open, close, isClosed: false }]));

const store = (over = {}) => ({
  _id: "s1",
  name: "Corner Grocer",
  timezone: "Europe/London",
  operatingHours: everyDay("09:00", "12:00"),
  fulfilment: { deliveryEnabled: true, collectionEnabled: true, slotLengthMins: 60, leadTimeMins: 60, maxOrdersPerSlot: 0, daysAhead: 3 },
  ...over,
});

// Monday 16 Nov 2026, 07:00 in London (GMT, so 07:00Z)
const NOW = new Date("2026-11-16T07:00:00Z");

describe("timezone maths", () => {
  it("turns London wall-clock time into UTC across summer and winter", () => {
    assert.equal(zonedToUtc("2026-07-01", 9 * 60, "Europe/London").toISOString(), "2026-07-01T08:00:00.000Z");
    assert.equal(zonedToUtc("2026-12-01", 9 * 60, "Europe/London").toISOString(), "2026-12-01T09:00:00.000Z");
    // clocks go forward 29 Mar 2026 at 01:00 GMT
    assert.equal(zonedToUtc("2026-03-29", 30, "Europe/London").toISOString(), "2026-03-29T00:30:00.000Z");
    assert.equal(zonedToUtc("2026-03-29", 3 * 60, "Europe/London").toISOString(), "2026-03-29T02:00:00.000Z");
    // minutes past midnight roll into the next day
    assert.equal(zonedToUtc("2026-12-01", 25 * 60, "Europe/London").toISOString(), "2026-12-02T01:00:00.000Z");
  });

  it("reads the store-local date and labels days", () => {
    assert.equal(localDate(new Date("2026-07-01T23:30:00Z"), "Europe/London"), "2026-07-02");
    assert.equal(dayLabel("2026-11-16", "2026-11-16"), "Today");
    assert.equal(dayLabel("2026-11-17", "2026-11-16"), "Tomorrow");
    assert.equal(dayLabel("2026-11-19", "2026-11-16"), "Thu 19 Nov");
  });
});

describe("slots", () => {
  it("cuts opening hours into windows after the lead time", () => {
    const slots = slotsForDate({ store: store(), date: "2026-11-16", now: NOW });
    assert.deepEqual(slots.map((s) => s.label), ["09:00–10:00", "10:00–11:00", "11:00–12:00"]);
    assert.equal(slots[0].start.toISOString(), "2026-11-16T09:00:00.000Z");
    assert.ok(slots.every((s) => s.available && s.remaining === null));

    const late = slotsForDate({ store: store(), date: "2026-11-16", now: new Date("2026-11-16T08:30:00Z") });
    assert.deepEqual(late.map((s) => s.label), ["10:00–11:00", "11:00–12:00"], "09:00 is inside the 60-minute lead time");
  });

  it("offers only daysAhead days, none for closed days, none when scheduling is off", () => {
    assert.equal(slotsForDate({ store: store(), date: "2026-11-19", now: NOW }).length, 0, "day 4 of 3");
    assert.equal(slotsForDate({ store: store(), date: "2026-11-18", now: NOW }).length, 3);
    const hours = everyDay("09:00", "12:00");
    hours.set("tuesday", { open: "09:00", close: "12:00", isClosed: true });
    assert.equal(slotsForDate({ store: store({ operatingHours: hours }), date: "2026-11-17", now: NOW }).length, 0);
    const off = store({ fulfilment: { ...store().fulfilment, daysAhead: 0 } });
    assert.equal(slotsForDate({ store: off, date: "2026-11-16", now: NOW }).length, 0);
  });

  it("handles hours that run past midnight", () => {
    const s = store({ operatingHours: everyDay("22:00", "01:00") });
    const slots = slotsForDate({ store: s, date: "2026-11-16", now: NOW });
    assert.deepEqual(slots.map((x) => x.label), ["22:00–23:00", "23:00–00:00", "00:00–01:00"]);
    const found = findSlot({ store: s, slotStart: "2026-11-17T00:00:00.000Z", now: NOW });
    assert.equal(found.label, "00:00–01:00", "a 00:00 slot belongs to the previous day's hours");
  });

  it("counts capacity per window", () => {
    const s = store({ fulfilment: { ...store().fulfilment, maxOrdersPerSlot: 2 } });
    const bookings = new Map([["2026-11-16T09:00:00.000Z", 2], ["2026-11-16T10:00:00.000Z", 1]]);
    const slots = slotsForDate({ store: s, date: "2026-11-16", bookings, now: NOW });
    assert.deepEqual(slots.map((x) => [x.remaining, x.available]), [[0, false], [1, true], [2, true]]);
  });

  it("only recognises slots the store actually offers", () => {
    assert.ok(findSlot({ store: store(), slotStart: "2026-11-16T10:00:00.000Z", now: NOW }));
    assert.equal(findSlot({ store: store(), slotStart: "2026-11-16T10:30:00.000Z", now: NOW }), null);
    assert.equal(findSlot({ store: store(), slotStart: "2026-11-16T13:00:00.000Z", now: NOW }), null);
    assert.equal(findSlot({ store: store(), slotStart: "not a date", now: NOW }), null);
  });
});

describe("collection pricing", () => {
  it("never charges delivery for a collected order", () => {
    const items = [{ unitPrice: 500, quantity: 1 }];
    assert.equal(priceStoreGroup({ items, shippingMethod: { fee: 2.5 } }).shippingFee, 250);
    const p = priceStoreGroup({ items, shippingMethod: { fee: 2.5 }, fulfilmentMethod: "collection" });
    assert.equal(p.shippingFee, 0);
    assert.equal(p.total, 500);
  });

  it("drops the free-delivery nudge when collecting", () => {
    const g = {
      storeId: "s1",
      store: {},
      settings: { shipping: { freeShippingThreshold: 30 } },
      shippingMethod: { fee: 2.5 },
      items: [{ product: "p", unitPrice: 500, quantity: 1 }],
    };
    assert.ok(priceCart({ groups: [g] }).nearMisses.some((n) => n.kind === "free_delivery"));
    assert.equal(priceCart({ groups: [{ ...g, method: "collection" }] }).nearMisses.length, 0);
  });
});
