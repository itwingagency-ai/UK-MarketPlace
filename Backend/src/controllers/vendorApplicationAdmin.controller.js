const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Store = require("../models/Store");
const StoreSettings = require("../models/StoreSettings");
const User = require("../models/User");
const VendorApplication = require("../models/VendorApplication");
const {
  normalizeSlug,
  validateAdminApprovePayload,
} = require("../validators/vendorApplication.validator");
const {
  onVendorApplicationApproved,
  onVendorApplicationRejected,
} = require("../lib/notificationHooks");

const isReplicaSetTransactionError = (err) => {
  const msg = String(err?.message || "");
  return (
    err?.name === "MongoServerError" &&
    (msg.includes("replica set") ||
      msg.includes("mongos") ||
      msg.includes("Transaction numbers"))
  );
};

const buildApproveResponse = (application, store, applicant) => ({
  message: "Application approved and store created",
  data: {
    application,
    store: {
      id: store._id,
      name: store.name,
      slug: store.slug,
    },
    applicant: {
      id: applicant._id,
      email: applicant.email,
      role: applicant.role,
    },
  },
});

/** Used when MongoDB is not replica-set (standalone); ordered writes + compensation */
const approveWithCompensation = async (
  applicationId,
  overrides,
  adminUserId
) => {
  let promotedUserId = null;
  let storeId = null;

  try {
    const application = await VendorApplication.findById(applicationId);
    if (!application) {
      throw new ApiError(404, "Application not found");
    }
    if (application.status !== "pending") {
      throw new ApiError(400, "Only pending applications can be approved");
    }

    const applicant = await User.findById(application.applicant);
    if (!applicant) {
      throw new ApiError(400, "Applicant user not found");
    }
    if (applicant.role !== "customer") {
      throw new ApiError(
        409,
        "Applicant is not a customer; cannot approve this application"
      );
    }
    if (applicant.storeId) {
      throw new ApiError(409, "Applicant already has a store assigned");
    }

    const storeName =
      overrides.storeName !== undefined
        ? overrides.storeName
        : application.storeName;
    const slug =
      overrides.slug !== undefined
        ? overrides.slug
        : normalizeSlug(application.slug);

    const existingStoreSlug = await Store.findOne({ slug });
    if (existingStoreSlug) {
      throw new ApiError(
        409,
        "Store slug already exists; adjust slug and try again"
      );
    }

    const store = await Store.create({
      name: storeName,
      slug,
      owner: applicant._id,
      description: application.description || "",
      status: "active",
      contact: {
        phone: application.contact?.phone || "",
        email:
          application.contact?.email?.trim()?.toLowerCase() || applicant.email,
      },
      address: application.address || {},
    });
    storeId = store._id;

    applicant.role = "vendor";
    applicant.storeId = store._id;
    await applicant.save();
    promotedUserId = applicant._id.toString();

    application.status = "approved";
    application.reviewedBy = adminUserId;
    application.reviewedAt = new Date();
    if (overrides.storeName !== undefined) {
      application.storeName = storeName;
    }
    if (overrides.slug !== undefined) {
      application.slug = slug;
    }
    await application.save();

    await StoreSettings.create({
      store: store._id,
      branding: { displayName: storeName },
    });

    onVendorApplicationApproved(applicant, store, application);
    return buildApproveResponse(application, store, applicant);
  } catch (err) {
    if (promotedUserId) {
      await User.findByIdAndUpdate(promotedUserId, {
        $set: { role: "customer", storeId: null },
      });
    }
    if (storeId) {
      await StoreSettings.deleteOne({ store: storeId }).catch(() => {});
      await Store.findByIdAndDelete(storeId).catch(() => {});
    }
    throw err;
  }
};

const parsePagination = (req) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const listApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req);
  const filter = {};
  if (
    req.query.status &&
    ["pending", "approved", "rejected"].includes(req.query.status)
  ) {
    filter.status = req.query.status;
  }

  const [applications, total] = await Promise.all([
    VendorApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("applicant", "name email role storeId"),
    VendorApplication.countDocuments(filter),
  ]);

  res.status(200).json({ page, limit, total, data: applications });
});

const getApplicationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid application id");
  }

  const application = await VendorApplication.findById(id).populate([
    { path: "applicant", select: "name email role storeId createdAt" },
    { path: "reviewedBy", select: "name email" },
  ]);

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  res.status(200).json({ data: application });
});

const rejectApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid application id");
  }

  const application = await VendorApplication.findById(id);
  if (!application) {
    throw new ApiError(404, "Application not found");
  }
  if (application.status !== "pending") {
    throw new ApiError(400, "Only pending applications can be rejected");
  }

  application.status = "rejected";
  application.reviewedBy = req.user.id;
  application.reviewedAt = new Date();
  application.adminNote =
    typeof req.body?.adminNote === "string"
      ? req.body.adminNote.slice(0, 500)
      : "";
  await application.save();

  const applicant = await User.findById(application.applicant).select(
    "name email phone"
  );
  if (applicant) {
    onVendorApplicationRejected(applicant, application, application.adminNote);
  }

  res.status(200).json({
    message: "Application rejected",
    data: application,
  });
});

const approveApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid application id");
  }

  const overrides = validateAdminApprovePayload(req.body);
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const application = await VendorApplication.findById(id).session(session);
    if (!application) {
      throw new ApiError(404, "Application not found");
    }
    if (application.status !== "pending") {
      throw new ApiError(400, "Only pending applications can be approved");
    }

    const applicant = await User.findById(application.applicant).session(
      session
    );
    if (!applicant) {
      throw new ApiError(400, "Applicant user not found");
    }
    if (applicant.role !== "customer") {
      throw new ApiError(
        409,
        "Applicant is not a customer; cannot approve this application"
      );
    }
    if (applicant.storeId) {
      throw new ApiError(409, "Applicant already has a store assigned");
    }

    const storeName =
      overrides.storeName !== undefined
        ? overrides.storeName
        : application.storeName;
    const slug =
      overrides.slug !== undefined
        ? overrides.slug
        : normalizeSlug(application.slug);

    const existingStoreSlug = await Store.findOne({ slug }).session(session);
    if (existingStoreSlug) {
      throw new ApiError(
        409,
        "Store slug already exists; adjust slug and try again"
      );
    }

    const [store] = await Store.create(
      [
        {
          name: storeName,
          slug,
          owner: applicant._id,
          description: application.description || "",
          status: "active",
          contact: {
            phone: application.contact?.phone || "",
            email:
              application.contact?.email?.trim()?.toLowerCase() ||
              applicant.email,
          },
          address: application.address || {},
        },
      ],
      { session }
    );

    applicant.role = "vendor";
    applicant.storeId = store._id;
    await applicant.save({ session });

    application.status = "approved";
    application.reviewedBy = req.user.id;
    application.reviewedAt = new Date();
    if (overrides.storeName !== undefined) {
      application.storeName = storeName;
    }
    if (overrides.slug !== undefined) {
      application.slug = slug;
    }
    await application.save({ session });

    await StoreSettings.create(
      [
        {
          store: store._id,
          branding: { displayName: storeName },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    onVendorApplicationApproved(applicant, store, application);
    return res
      .status(200)
      .json(buildApproveResponse(application, store, applicant));
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      // ignore
    }

    if (isReplicaSetTransactionError(err)) {
      const payload = await approveWithCompensation(
        id,
        overrides,
        req.user.id
      );
      return res.status(200).json(payload);
    }

    if (err instanceof ApiError) throw err;
    throw err;
  } finally {
    session.endSession();
  }
});

module.exports = {
  listApplications,
  getApplicationById,
  rejectApplication,
  approveApplication,
};
