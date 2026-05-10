<<<<<<< HEAD
=======
const crypto = require("crypto");
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
const mongoose = require("mongoose");

const ORDER_STATUS = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];
const PAYMENT_METHODS = ["cod", "online"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
<<<<<<< HEAD
=======
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
    title: {
      type: String,
      required: true,
      trim: true,
    },
<<<<<<< HEAD
=======
    sku: {
      type: String,
      default: "",
      trim: true,
    },
    attributes: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

<<<<<<< HEAD
const orderSchema = new mongoose.Schema(
  {
=======
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ORDER_STATUS,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changedByRole: {
      type: String,
      default: "",
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "" },
  },
  { _id: false }
);

const paymentEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      required: true,
    },
    provider: {
      type: String,
      enum: ["stripe", "cod", "manual", "system"],
      default: "system",
    },
    providerRef: { type: String, default: "" },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    byRole: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "", maxlength: 500 },
  },
  { _id: false }
);

const SHIPMENT_EVENT_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivery_attempted",
  "delivered",
  "exception",
];

const shipmentEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: SHIPMENT_EVENT_STATUSES,
      required: true,
    },
    at: { type: Date, default: Date.now },
    location: { type: String, default: "", maxlength: 200 },
    note: { type: String, default: "", maxlength: 500 },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    byRole: { type: String, default: "" },
  },
  { _id: false }
);

const trackingSchema = new mongoose.Schema(
  {
    carrier: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "", maxlength: 500 },
    estimatedDeliveryEarliest: { type: Date, default: null },
    estimatedDeliveryLatest: { type: Date, default: null },
    events: { type: [shipmentEventSchema], default: [] },
  },
  { _id: false }
);

const orderShippingMethodSchema = new mongoose.Schema(
  {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShippingMethod",
      default: null,
    },
    code: { type: String, default: "" },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    fee: { type: Number, default: 0, min: 0 },
    minDays: { type: Number, default: 0, min: 0 },
    maxDays: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
<<<<<<< HEAD
    items: {
      type: [orderItemSchema],
      validate: [(arr) => arr.length > 0, "Order must contain at least one item"],
=======
    customerSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "", lowercase: true, trim: true },
      phone: { type: String, default: "" },
    },
    shippingAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    items: {
      type: [orderItemSchema],
      validate: [
        (arr) => Array.isArray(arr) && arr.length > 0,
        "Order must contain at least one item",
      ],
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
<<<<<<< HEAD
=======
      index: true,
>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
    },
    orderStatus: {
      type: String,
      enum: ORDER_STATUS,
      default: "pending",
      index: true,
    },
<<<<<<< HEAD
  },
  { timestamps: true }
);

=======
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    paymentEvents: {
      type: [paymentEventSchema],
      default: [],
    },
    paymentTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
      index: true,
    },
    commission: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
      rate: { type: Number, default: 0, min: 0, max: 1 },
      fixed: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
      calculatedAt: { type: Date, default: null },
      sourceRate: {
        type: String,
        enum: ["store", "platform", null],
        default: null,
      },
    },
    shippingMethod: {
      type: orderShippingMethodSchema,
      default: () => ({}),
    },
    tracking: {
      type: trackingSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, flattenMaps: true },
    toObject: { virtuals: true, flattenMaps: true },
  }
);

const formatYmd = (date) => {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
};

const generateOrderNumber = () =>
  `ORD-${formatYmd(new Date())}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

orderSchema.pre("validate", function preValidateOrder(next) {
  if (!this.orderNumber) {
    this.orderNumber = generateOrderNumber();
  }
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      {
        status: this.orderStatus || "pending",
        changedAt: new Date(),
        note: "Order placed",
      },
    ];
  }
  next();
});

orderSchema.statics.ORDER_STATUS = ORDER_STATUS;
orderSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
orderSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
orderSchema.statics.SHIPMENT_EVENT_STATUSES = SHIPMENT_EVENT_STATUSES;

>>>>>>> 6bc776ee27df335a77035d2b3ee2cd4147284a81
module.exports = mongoose.model("Order", orderSchema);
