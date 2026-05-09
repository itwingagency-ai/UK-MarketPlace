const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
const {
  ALLOWED_USER_ROLES,
  ALLOWED_USER_STATUSES,
  validateAdminUserUpdate,
} = require("../validators/admin.validator");

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitize = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  role: user.role,
  status: user.status,
  storeId: user.storeId || null,
  addressCount: Array.isArray(user.addresses) ? user.addresses.length : 0,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.role) {
    if (!ALLOWED_USER_ROLES.includes(req.query.role)) {
      throw new ApiError(400, "Invalid role filter");
    }
    filter.role = req.query.role;
  }

  if (req.query.status) {
    if (!ALLOWED_USER_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.status = req.query.status;
  }

  if (req.query.search) {
    const re = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    page,
    limit,
    total,
    data: users.map(sanitize),
  });
});

const getUserById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid user id");
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  res.status(200).json({
    data: {
      ...sanitize(user),
      addresses: user.addresses || [],
    },
  });
});

const updateUser = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid user id");
  }
  validateAdminUserUpdate(req.body);

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  if (String(user._id) === String(req.user.id)) {
    if (req.body.status === "suspended") {
      throw new ApiError(400, "You cannot suspend your own account");
    }
    if (req.body.role !== undefined && req.body.role !== user.role) {
      throw new ApiError(400, "You cannot change your own role");
    }
  }

  if (req.body.role !== undefined && req.body.role !== user.role) {
    if (user.role === "vendor" && req.body.role !== "vendor") {
      throw new ApiError(
        409,
        "Cannot directly change a vendor role; use store suspension instead"
      );
    }
  }

  if (req.body.name !== undefined) user.name = req.body.name.trim();
  if (req.body.phone !== undefined) user.phone = (req.body.phone || "").trim();
  if (req.body.role !== undefined) user.role = req.body.role;

  let newlySuspended = false;
  if (req.body.status !== undefined && req.body.status !== user.status) {
    user.status = req.body.status;
    newlySuspended = req.body.status === "suspended";
  }

  await user.save();

  if (newlySuspended) {
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  res.status(200).json({ message: "User updated", data: sanitize(user) });
});

const suspendUser = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid user id");
  }
  if (String(req.params.id) === String(req.user.id)) {
    throw new ApiError(400, "You cannot suspend your own account");
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.status === "suspended") {
    return res
      .status(200)
      .json({ message: "User already suspended", data: sanitize(user) });
  }

  user.status = "suspended";
  await user.save();
  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  res.status(200).json({ message: "User suspended", data: sanitize(user) });
});

const reactivateUser = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid user id");
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.status === "active") {
    return res
      .status(200)
      .json({ message: "User already active", data: sanitize(user) });
  }
  user.status = "active";
  await user.save();
  res.status(200).json({ message: "User reactivated", data: sanitize(user) });
});

module.exports = {
  listUsers,
  getUserById,
  updateUser,
  suspendUser,
  reactivateUser,
};
