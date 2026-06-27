const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Store = require("../models/Store");
const User = require("../models/User");
const VendorApplication = require("../models/VendorApplication");
const { validateVendorApplicationSubmit } = require("../validators/vendorApplication.validator");
const { onVendorApplicationSubmitted } = require("../lib/notificationHooks");

const submitApplication = asyncHandler(async (req, res) => {
  const { storeName, slug } = validateVendorApplicationSubmit(req.body);

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new ApiError(401, "User not found");
  }
  if (user.role !== "customer") {
    throw new ApiError(403, "Only customers can submit a vendor application");
  }
  if (user.storeId) {
    throw new ApiError(409, "You already have a store linked to this account");
  }

  const pending = await VendorApplication.findOne({
    applicant: user._id,
    status: "pending",
  });
  if (pending) {
    throw new ApiError(409, "You already have a pending application");
  }

  const slugTaken = await Store.findOne({ slug });
  if (slugTaken) {
    throw new ApiError(409, "This store URL slug is already in use");
  }

  const application = await VendorApplication.create({
    applicant: user._id,
    storeName,
    slug,
    description: req.body.description || "",
    contact: {
      phone: req.body.contact?.phone || "",
      email: req.body.contact?.email || "",
    },
    address: {
      line1: req.body.address?.line1 || "",
      line2: req.body.address?.line2 || "",
      city: req.body.address?.city || "",
      state: req.body.address?.state || "",
      postalCode: req.body.address?.postalCode || "",
      country: req.body.address?.country || "",
    },
  });

  onVendorApplicationSubmitted(user, application);

  res.status(201).json({
    message: "Application submitted",
    data: application,
  });
});

const getMyLatestApplication = asyncHandler(async (req, res) => {
  const application = await VendorApplication.findOne({ applicant: req.user.id })
    .sort({ updatedAt: -1 })
    .populate("reviewedBy", "name email");

  if (!application) {
    return res.status(200).json({ data: null });
  }

  res.status(200).json({ data: application });
});

module.exports = {
  submitApplication,
  getMyLatestApplication,
};
