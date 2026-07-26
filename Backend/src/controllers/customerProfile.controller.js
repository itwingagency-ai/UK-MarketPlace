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
    lat: req.body.lat != null ? Number(req.body.lat) : null,
    lng: req.body.lng != null ? Number(req.body.lng) : null,
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
  if (req.body.lat !== undefined) {
    address.lat = req.body.lat != null ? Number(req.body.lat) : null;
  }
  if (req.body.lng !== undefined) {
    address.lng = req.body.lng != null ? Number(req.body.lng) : null;
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

const getFavorites = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;

  const user = await User.findById(req.user.id)
    .populate("favoriteStores")
    .populate({
      path: "favoriteProducts",
      populate: { path: "store", select: "location locationSet deliveryRadiusKm" }
    });
  if (!user) throw new ApiError(404, "User not found");

  const StoreSettings = require("../models/StoreSettings");
  const Review = require("../models/Review");
  const ShippingMethod = require("../models/ShippingMethod");
  
  let favoriteStores = user.favoriteStores || [];
  let favoriteProducts = user.favoriteProducts || [];

  const checkDelivery = (storeLat, storeLng, radius) => {
    if (!lat || !lng) return true;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat - storeLat) * (Math.PI / 180);
    const dLon = (lng - storeLng) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(storeLat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; 
    return distance <= radius;
  };

  if (favoriteStores.length > 0) {
    const storeIds = favoriteStores.map(s => s._id);
    
    const [settingsList, reviews, shippingMethods] = await Promise.all([
      StoreSettings.find({ store: { $in: storeIds } }).select("store branding"),
      Review.aggregate([
        { $match: { store: { $in: storeIds }, status: "approved" } },
        { $group: { _id: "$store", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
      ]),
      ShippingMethod.find({ store: { $in: storeIds }, isActive: true })
    ]);

    const settingsMap = new Map(settingsList.map(s => [s.store.toString(), s.branding]));
    const reviewMap = new Map(reviews.map(r => [r._id.toString(), r]));
    const shippingMap = new Map();
    for (const method of shippingMethods) {
      const storeIdStr = method.store.toString();
      if (!shippingMap.has(storeIdStr)) shippingMap.set(storeIdStr, []);
      shippingMap.get(storeIdStr).push(method);
    }

    favoriteStores = favoriteStores.map(store => {
      const storeObj = store.toObject();
      const storeIdStr = storeObj._id.toString();
      
      storeObj.branding = settingsMap.get(storeIdStr) || null;
      
      const reviewData = reviewMap.get(storeIdStr);
      if (reviewData) {
        storeObj.averageRating = reviewData.averageRating;
        storeObj.ratingCount = reviewData.ratingCount;
      }
      
      const storeShipping = shippingMap.get(storeIdStr) || [];
      const cheapestShipping = storeShipping.sort((a, b) => a.fee - b.fee)[0];
      
      if (cheapestShipping) {
        storeObj.deliveryFee = cheapestShipping.fee;
        if (cheapestShipping.minDays === 0 && cheapestShipping.maxDays === 0) {
          storeObj.deliveryTime = "Same day";
        } else if (cheapestShipping.minDays === cheapestShipping.maxDays) {
          storeObj.deliveryTime = `${cheapestShipping.minDays} day${cheapestShipping.minDays !== 1 ? 's' : ''}`;
        } else {
          storeObj.deliveryTime = `${cheapestShipping.minDays}-${cheapestShipping.maxDays} days`;
        }
      }

      storeObj.deliversToLocation = true;
      if (storeObj.location && storeObj.locationSet) {
        storeObj.deliversToLocation = checkDelivery(
          storeObj.location.coordinates[1],
          storeObj.location.coordinates[0],
          storeObj.deliveryRadiusKm
        );
      }
      
      return storeObj;
    });
  }

  if (favoriteProducts.length > 0) {
    favoriteProducts = favoriteProducts.map(product => {
      const prodObj = product.toObject();
      prodObj.deliversToLocation = true;
      if (prodObj.store && prodObj.store.location && prodObj.store.locationSet) {
        prodObj.deliversToLocation = checkDelivery(
          prodObj.store.location.coordinates[1],
          prodObj.store.location.coordinates[0],
          prodObj.store.deliveryRadiusKm
        );
      }
      return prodObj;
    });
  }

  res.status(200).json({
    data: {
      favoriteStores,
      favoriteProducts,
    },
  });
});

const addFavoriteStore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid store id");
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (!user.favoriteStores.includes(id)) {
    user.favoriteStores.push(id);
    await user.save();
  }

  res.status(200).json({ message: "Store added to favorites", data: id });
});

const removeFavoriteStore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid store id");
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  user.favoriteStores.pull(id);
  await user.save();

  res.status(200).json({ message: "Store removed from favorites" });
});

const addFavoriteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product id");
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (!user.favoriteProducts.includes(id)) {
    user.favoriteProducts.push(id);
    await user.save();
  }

  res.status(200).json({ message: "Product added to favorites", data: id });
});

const removeFavoriteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product id");
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  user.favoriteProducts.pull(id);
  await user.save();

  res.status(200).json({ message: "Product removed from favorites" });
});

module.exports = {
  getMe,
  updateMe,
  changePassword,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getFavorites,
  addFavoriteStore,
  removeFavoriteStore,
  addFavoriteProduct,
  removeFavoriteProduct,
};
