/**
 * A store's own delivery riders, assigning them to orders, and changing an
 * order's items while it's being packed.
 *   GET    /vendor/dashboard/riders
 *   POST   /vendor/dashboard/riders              { name, email, phone, password }
 *   PATCH  /vendor/dashboard/riders/:id          { name?, phone?, status?, password? }
 *   PATCH  /vendor/dashboard/orders/:id/rider    { riderId | null }
 *   PATCH  /vendor/dashboard/orders/:id/items/:index  { action, quantity?, productId?, variantId? }
 *
 * Riders are vendor-employed (plan §5): each belongs to exactly one store.
 */
const mongoose = require("mongoose");
const validator = require("validator");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const User = require("../models/User");
const { adjustOrderItem } = require("../lib/orderAdjustments");
const { notifyOrderChanged, notifyRiderAssigned } = require("../lib/appNotifications");
const { emitOrderStatusChanged } = require("../lib/orderEvents");

const storeIdOf = (req) => {
  if (!req.storeScopeId) throw new ApiError(400, "Pick a store first");
  return req.storeScopeId;
};

const publicRider = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone || "",
  status: u.status,
  createdAt: u.createdAt,
});

const checkPassword = (password) => {
  if (typeof password !== "string" || password.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(password)) {
    throw new ApiError(400, "Password must be at least 8 characters with upper, lower case and a number");
  }
};

const listRiders = asyncHandler(async (req, res) => {
  const riders = await User.find({ role: "rider", storeId: storeIdOf(req) }).sort({ name: 1 }).lean();
  res.status(200).json({ data: riders.map(publicRider) });
});

const createRider = asyncHandler(async (req, res) => {
  const { name, email, phone = "", password } = req.body || {};
  if (typeof name !== "string" || name.trim().length < 2) throw new ApiError(400, "Name must be at least 2 characters");
  if (typeof email !== "string" || !validator.isEmail(email.trim())) throw new ApiError(400, "Enter a valid email");
  checkPassword(password);
  const normalized = email.trim().toLowerCase();
  if (await User.exists({ email: normalized })) throw new ApiError(409, "That email already has an account");

  const rider = await User.create({
    name: name.trim(),
    email: normalized,
    phone: String(phone).trim().slice(0, 30),
    password,
    role: "rider",
    status: "active",
    storeId: storeIdOf(req),
  });
  res.status(201).json({ message: "Rider added. They can sign in to the app with this email and password.", data: publicRider(rider) });
});

const updateRider = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const rider = await User.findOne({ _id: req.params.id, role: "rider", storeId: storeIdOf(req) }).select("+password");
  if (!rider) throw new ApiError(404, "Rider not found");
  const { name, phone, status, password } = req.body || {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) throw new ApiError(400, "Name must be at least 2 characters");
    rider.name = name.trim();
  }
  if (phone !== undefined) rider.phone = String(phone).trim().slice(0, 30);
  if (status !== undefined) {
    if (!["active", "suspended"].includes(status)) throw new ApiError(400, "status must be active or suspended");
    rider.status = status;
  }
  if (password !== undefined) {
    checkPassword(password);
    rider.password = password;
  }
  await rider.save();
  res.status(200).json({ message: "Rider updated", data: publicRider(rider) });
});

/** Give a delivery order to one of the store's riders (or take it back). */
const assignRider = asyncHandler(async (req, res) => {
  const order = req.scopedResource;
  if (order.fulfilment?.method === "collection") throw new ApiError(409, "Collection orders don't need a rider");
  if (!["pending", "confirmed", "packed", "shipped"].includes(order.orderStatus)) {
    throw new ApiError(409, `A ${order.orderStatus} order can't be reassigned`);
  }
  const { riderId } = req.body || {};
  if (riderId === null) {
    if (order.orderStatus === "shipped") throw new ApiError(409, "The rider is already on the way");
    order.delivery.rider = null;
    order.delivery.riderName = "";
    order.delivery.assignedAt = null;
  } else {
    if (!mongoose.Types.ObjectId.isValid(riderId)) throw new ApiError(400, "Invalid rider");
    const rider = await User.findOne({ _id: riderId, role: "rider", storeId: order.store, status: "active" });
    if (!rider) throw new ApiError(404, "Rider not found, or not active");
    order.delivery.rider = rider._id;
    order.delivery.riderName = rider.name;
    order.delivery.assignedAt = new Date();
    notifyRiderAssigned(order, rider);
  }
  await order.save();
  emitOrderStatusChanged(order, order.orderStatus);
  res.status(200).json({ message: riderId ? `Assigned to ${order.delivery.riderName}` : "Rider removed", data: order });
});

/** Mark a line unavailable, substitute it, or record it refused at handover. */
const adjustItem = asyncHandler(async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) throw new ApiError(400, "Invalid item");
  const { order, refundAmount, refund, note } = await adjustOrderItem(
    req.scopedResource,
    index,
    req.body || {},
    { id: req.user.id, role: req.user.role }
  );
  emitOrderStatusChanged(order, order.orderStatus);
  notifyOrderChanged(order, { note, refundAmount });
  res.status(200).json({
    message:
      refund && refund.refunded === false && refund.reason !== "not_charged"
        ? `${note}. The refund needs doing by hand: ${refund.reason}`
        : refundAmount > 0
          ? `${note}. £${(refundAmount / 100).toFixed(2)} goes back to the customer`
          : note,
    data: order,
  });
});

module.exports = { listRiders, createRider, updateRider, assignRider, adjustItem };
