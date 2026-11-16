/**
 * Rider app API (role "rider", vendor-employed, one store).
 *   GET  /rider/orders?scope=active|done     my deliveries
 *   GET  /rider/orders/:id
 *   POST /rider/orders/:id/pickup            -> out for delivery
 *   POST /rider/orders/:id/deliver           proof (photo and/or recipient), age check
 *
 * Live location goes over Socket.IO ("rider:location"), not REST: see
 * lib/riderLocation.
 */
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Order = require("../models/Order");
const { transitionOrder } = require("../lib/orderTransitions");
const { adjustOrderItem, CHARGED } = require("../lib/orderAdjustments");

const ID_TYPES = ["passport", "driving_licence", "pass_card", "other_photo_id"];

const myOrder = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid order");
  const order = await Order.findOne({ _id: req.params.id, "delivery.rider": req.user.id });
  if (!order) throw new ApiError(404, "That delivery isn't assigned to you");
  return order;
};

const actor = (req) => ({ id: req.user.id, role: "rider" });

const listMyOrders = asyncHandler(async (req, res) => {
  const done = req.query.scope === "done";
  const filter = done
    ? { "delivery.rider": req.user.id, orderStatus: { $in: ["delivered", "cancelled"] }, updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    : { "delivery.rider": req.user.id, orderStatus: { $in: ["pending", "confirmed", "packed", "shipped"] } };
  const orders = await Order.find(filter)
    .sort(done ? { updatedAt: -1 } : { "fulfilment.slotStart": 1, createdAt: 1 })
    .limit(100)
    .populate("store", "name address contact")
    .lean();
  res.status(200).json({ data: orders });
});

const getMyOrder = asyncHandler(async (req, res) => {
  const order = await myOrder(req);
  await order.populate("store", "name address contact");
  res.status(200).json({ data: order });
});

const pickup = asyncHandler(async (req, res) => {
  const order = await myOrder(req);
  if (!["confirmed", "packed"].includes(order.orderStatus)) {
    throw new ApiError(409, order.orderStatus === "pending" ? "The store hasn't accepted this order yet" : `This order is ${order.orderStatus}`);
  }
  // A store that skips "packed" still gets a complete history
  if (order.orderStatus === "confirmed") {
    await transitionOrder(order, "packed", { actor: actor(req), note: "Packed (picked up by rider)" });
  }
  order.delivery.pickedUpAt = new Date();
  await transitionOrder(order, "shipped", { actor: actor(req), note: `Out for delivery with ${order.delivery.riderName || "rider"}` });
  res.status(200).json({ message: "On your way", data: order });
});

/**
 * Body (multipart or JSON):
 *   photo            optional image file (doorstep photo)
 *   recipientName    who took it (photo or name required)
 *   ageVerified      "true" when ID was checked for an age-restricted order
 *   idType           passport | driving_licence | pass_card | other_photo_id
 *   refuseRestricted "true": no valid ID, so age-restricted items go back
 *                    (refunded) and the rest is delivered
 */
const deliver = asyncHandler(async (req, res) => {
  const order = await myOrder(req);
  if (order.orderStatus !== "shipped") throw new ApiError(409, "Pick the order up first");

  const truthy = (v) => v === true || v === "true";
  const recipientName = typeof req.body.recipientName === "string" ? req.body.recipientName.trim().slice(0, 80) : "";
  const photoUrl = req.file?.location || "";
  if (!photoUrl && !recipientName) throw new ApiError(400, "Add a photo or the name of who took the order");

  let refused = [];
  if (order.ageCheck > 0) {
    if (truthy(req.body.refuseRestricted)) {
      refused = order.items.map((item, i) => ({ item, i })).filter(({ item }) => CHARGED(item) && item.minAge > 0);
      for (const { i } of refused) {
        // eslint-disable-next-line no-await-in-loop
        await adjustOrderItem(order, i, { action: "refused" }, actor(req));
      }
    } else {
      if (!truthy(req.body.ageVerified) || !ID_TYPES.includes(req.body.idType)) {
        throw new ApiError(400, `This order has over-${order.ageCheck} items: check photo ID, or hand over the rest without them`);
      }
      order.delivery.proof.ageVerified = true;
      order.delivery.proof.idType = req.body.idType;
    }
  }

  order.delivery.proof.photoUrl = photoUrl;
  order.delivery.proof.recipientName = recipientName;
  order.delivery.deliveredAt = new Date();

  // Everything was age-restricted and refused: nothing left to hand over
  if (!order.items.some(CHARGED)) {
    const { refund } = await transitionOrder(order, "cancelled", {
      actor: actor(req),
      note: "Not delivered: age-restricted items refused (no valid ID)",
      cancelReason: "Age check failed",
    });
    return res.status(200).json({ message: "Nothing could be handed over. The order is cancelled and refunded", data: order, refund });
  }

  await transitionOrder(order, "delivered", {
    actor: actor(req),
    note: refused.length ? `Delivered without ${refused.length} age-restricted item(s)` : "Delivered",
  });
  return res.status(200).json({ message: "Delivered", data: order });
});

module.exports = { listMyOrders, getMyOrder, pickup, deliver, ID_TYPES };
