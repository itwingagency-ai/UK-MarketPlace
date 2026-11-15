/**
 * Coupon redemptions: claimed with the orders they discount, released when
 * those orders are cancelled.
 *
 * A "use" of a coupon is one checkout. A platform coupon spread across three
 * store orders is one use (three CouponRedemption rows, one checkoutId); it
 * is given back only when all three orders are cancelled.
 *
 * Limits are enforced with conditional atomic updates, so two checkouts racing
 * for the last use cannot both win:
 *   Coupon.redemptionCount  < usageLimit    (total uses)
 *   CouponUsage.count       < perUserLimit  (uses by this customer)
 */
const ApiError = require("./ApiError");
const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");
const CouponUsage = require("../models/CouponUsage");

/** Coupon lines on placed orders, grouped by coupon id. */
const collectCouponLines = (orders) => {
  const byCoupon = new Map();
  for (const order of orders) {
    for (const line of order.priceLines || []) {
      if (line.kind !== "coupon" || !line.ref) continue;
      if (!byCoupon.has(line.ref)) byCoupon.set(line.ref, []);
      byCoupon.get(line.ref).push({ order, line });
    }
  }
  return byCoupon;
};

/**
 * Claim one use of every coupon on these orders and record a redemption per
 * order. Pass `session` to run inside the order-placement transaction; without
 * one, use the returned undo() if a later step fails.
 *
 * @returns {Promise<{ undo: () => Promise<void> }>}
 */
const claimCouponRedemptions = async ({ orders, userId, checkoutId, session = null }) => {
  const opts = session ? { session } : {};
  const claimed = [];
  const undo = async () => {
    for (const c of claimed.reverse()) {
      /* eslint-disable no-await-in-loop */
      if (c.rows) await CouponRedemption.deleteMany({ _id: { $in: c.rows } }).catch(() => {});
      if (c.usage) await CouponUsage.updateOne({ coupon: c.couponId, user: userId, count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});
      if (c.total) await Coupon.updateOne({ _id: c.couponId, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } }).catch(() => {});
      /* eslint-enable no-await-in-loop */
    }
  };

  try {
    for (const [couponId, entries] of collectCouponLines(orders)) {
      const code = entries[0].line.code;
      const record = { couponId };
      claimed.push(record);

      /* eslint-disable no-await-in-loop */
      const coupon = await Coupon.findOneAndUpdate(
        {
          _id: couponId,
          isActive: true,
          $or: [{ usageLimit: null }, { $expr: { $lt: ["$redemptionCount", "$usageLimit"] } }],
        },
        { $inc: { redemptionCount: 1 } },
        { ...opts, new: true }
      );
      if (!coupon) throw new ApiError(409, `Code ${code} has just been used up. Remove it to continue`);
      record.total = true;

      try {
        await CouponUsage.findOneAndUpdate(
          { coupon: couponId, user: userId, count: { $lt: coupon.perUserLimit || 1 } },
          { $inc: { count: 1 } },
          { ...opts, upsert: true, new: true }
        );
      } catch (err) {
        // The filter missed an existing row at the limit, so the upsert collided
        if (err?.code === 11000) {
          throw new ApiError(409, `You've already used code ${code}. Remove it to continue`);
        }
        throw err;
      }
      record.usage = true;

      const rows = await CouponRedemption.insertMany(
        entries.map(({ order, line }) => ({
          coupon: couponId,
          code,
          user: userId,
          order: order._id,
          store: order.store,
          checkoutId,
          amount: -Number(line.amount),
          fundedBy: line.fundedBy,
        })),
        { ...opts, ordered: true }
      );
      record.rows = rows.map((r) => r._id);
      /* eslint-enable no-await-in-loop */
    }
  } catch (err) {
    if (!session) await undo();
    throw err;
  }

  return { undo };
};

/**
 * Give back the coupon uses held by a cancelled order. Idempotent and never
 * throws: a failure is logged and leaves the use counted (safe side).
 */
const releaseCouponRedemptions = async (order, { reason = "Order cancelled" } = {}) => {
  try {
    const rows = await CouponRedemption.find({ order: order._id, status: "active" });
    for (const row of rows) {
      /* eslint-disable no-await-in-loop */
      const res = await CouponRedemption.updateOne(
        { _id: row._id, status: "active" },
        { $set: { status: "released", releasedAt: new Date(), releaseReason: reason.slice(0, 200) } }
      );
      if (res.modifiedCount === 0) continue;
      const stillHeld = await CouponRedemption.exists({
        coupon: row.coupon,
        checkoutId: row.checkoutId,
        status: "active",
      });
      if (stillHeld) continue;
      await Coupon.updateOne({ _id: row.coupon, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
      await CouponUsage.updateOne({ coupon: row.coupon, user: row.user, count: { $gt: 0 } }, { $inc: { count: -1 } });
      /* eslint-enable no-await-in-loop */
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[coupons] release failed for order ${order.orderNumber || order._id}: ${err.message}`);
  }
};

module.exports = { claimCouponRedemptions, releaseCouponRedemptions };
