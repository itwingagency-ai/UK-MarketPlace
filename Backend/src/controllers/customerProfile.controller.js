const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
const {
  validateAddressPayload,
  validatePasswordChange,
  validateProfileUpdate,
} = require("../validators/profile.validator");
const { onPasswordChanged } = require("../lib/notificationHooks");

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  role: user.role,
  status: user.status,
  storeId: user.storeId || null,
  addresses: user.addresses || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");
  res.status(200).json({ data: sanitizeUser(user) });
});

const updateMe = asyncHandler(async (req, res) => {
  validateProfileUpdate(req.body);

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (req.body.name !== undefined) {
    user.name = req.body.name.trim();
  }
  if (req.body.phone !== undefined) {
    user.phone = (req.body.phone || "").trim();
  }

  await user.save();
  res
    .status(200)
    .json({ message: "Profile updated", data: sanitizeUser(user) });
});

const changePassword = asyncHandler(async (req, res) => {
  validatePasswordChange(req.body);

  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  const isCurrentValid = await user.comparePassword(req.body.currentPassword);
  if (!isCurrentValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = req.body.newPassword;
  await user.save();

  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  onPasswordChanged(user);

  res.status(200).json({
    message:
      "Password changed. Existing sessions have been revoked; please log in again.",
  });
});

const listAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("addresses");
  res.status(200).json({ data: user?.addresses || [] });
});

const addAddress = asyncHandler(async (req, res) => {
  validateAddressPayload(req.body);

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const wantsDefault =
    Boolean(req.body.isDefault) || user.addresses.length === 0;

  user.addresses.push({
    label: (req.body.label || "Home").trim(),
    fullName: (req.body.fullName || "").trim(),
    phone: (req.body.phone || "").trim(),
    line1: req.body.line1.trim(),
    line2: (req.body.line2 || "").trim(),
    city: req.body.city.trim(),
    state: (req.body.state || "").trim(),
    postalCode: (req.body.postalCode || "").trim(),
    country: (req.body.country || "").trim(),
    isDefault: wantsDefault,
  });

  if (wantsDefault) {
    const newId = String(user.addresses[user.addresses.length - 1]._id);
    user.addresses.forEach((addr) => {
      addr.isDefault = String(addr._id) === newId;
    });
  }

  await user.save();
  const created = user.addresses[user.addresses.length - 1];
  res.status(201).json({ message: "Address added", data: created });
});

const updateAddress = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid address id");
  }
  validateAddressPayload(req.body, true);

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const address = user.addresses.id(req.params.id);
  if (!address) throw new ApiError(404, "Address not found");

  const fields = [
    "label",
    "fullName",
    "phone",
    "line1",
    "line2",
    "city",
    "state",
    "postalCode",
    "country",
  ];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      address[field] = (req.body[field] || "").trim();
    }
  }

  if (req.body.isDefault === true) {
    user.addresses.forEach((addr) => {
      addr.isDefault = String(addr._id) === String(address._id);
    });
  } else if (req.body.isDefault === false) {
    address.isDefault = false;
  }

  await user.save();
  res.status(200).json({ message: "Address updated", data: address });
});

const deleteAddress = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid address id");
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const address = user.addresses.id(req.params.id);
  if (!address) throw new ApiError(404, "Address not found");

  const wasDefault = address.isDefault;
  user.addresses.pull({ _id: address._id });

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();
  res.status(200).json({ message: "Address deleted" });
});

module.exports = {
  getMe,
  updateMe,
  changePassword,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};
