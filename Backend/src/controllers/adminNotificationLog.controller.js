const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Notification = require("../models/Notification");
const {
  isKnownEventType,
  NOTIFICATION_CHANNELS,
} = require("../lib/notificationTemplates");

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDate = (value, label) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${label} must be a valid ISO date`);
  }
  return d;
};

const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.userId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
      throw new ApiError(400, "Invalid userId filter");
    }
    filter.user = req.query.userId;
  }

  if (req.query.eventType) {
    if (!isKnownEventType(req.query.eventType)) {
      throw new ApiError(400, "Unknown event type");
    }
    filter.eventType = req.query.eventType;
  }

  if (req.query.channel) {
    if (!NOTIFICATION_CHANNELS.includes(req.query.channel)) {
      throw new ApiError(400, "Invalid channel filter");
    }
    filter["channels.channel"] = req.query.channel;
  }

  if (req.query.status) {
    const allowed = ["queued", "sent", "skipped", "failed"];
    if (!allowed.includes(req.query.status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter["channels.status"] = req.query.status;
  }

  if (req.query.search) {
    const re = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
    filter.$or = [
      { "recipient.email": re },
      { "recipient.phone": re },
      { "recipient.name": re },
      { subject: re },
    ];
  }

  const startDate = parseDate(req.query.startDate, "startDate");
  const endDate = parseDate(req.query.endDate, "endDate");
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email role"),
    Notification.countDocuments(filter),
  ]);

  res.status(200).json({
    page,
    limit,
    total,
    data: items,
  });
});

const getNotification = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApiError(400, "Invalid notification id");
  }
  const item = await Notification.findById(req.params.id).populate(
    "user",
    "name email role"
  );
  if (!item) throw new ApiError(404, "Notification not found");
  res.status(200).json({ data: item });
});

module.exports = {
  listNotifications,
  getNotification,
};
