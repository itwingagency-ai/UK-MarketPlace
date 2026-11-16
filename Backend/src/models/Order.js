const crypto = require("crypto");
const mongoose = require("mongoose");

// Delivery: pending -> confirmed -> packed -> shipped -> delivered
// Collection: pending -> confirmed (-> packed) -> ready_for_collection -> collected
const ORDER_STATUS = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "ready_for_collection",
  "collected",
  "cancelled",
];
// Statuses that mean the customer has their goods
const COMPLETED_STATUSES = ["delivered", "collected"];
const PAYMENT_METHODS = ["cod", "online"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
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
    minAge: { type: Number, default: 0 },
    // ok | unavailable (store couldn't supply) | substituted (swapped by the
    // store) | refused (age-restricted item refused at the door)
    lineStatus: {
      type: String,
      enum: ["ok", "unavailable", "substituted", "refused"],
      default: "ok",
    },
    originalQuantity: { type: Number, default: null },
    substitutedFor: { type: String, default: "" },
  },
  { _id: false }
);

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
    // Where the delivery-zone check placed the customer (for riders' maps)
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
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
    // Set once when a cancelled order's items go back into inventory
    stockRestoredAt: { type: Date, default: null },
    // Shop's estimate, given when accepting the order
    estimatedReadyAt: { type: Date, default: null },
    estimatedDeliveryEarliest: { type: Date, default: null },
    estimatedDeliveryLatest: { type: Date, default: null },
    events: { type: [shipmentEventSchema], default: [] },
  },
  { _id: false }
);

// One adjustment to a store's bill (see lib/pricing.js). amount is signed
// integer pence: negative for discount/coupon/loyalty, positive for fee/tip.
const priceLineSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["discount", "coupon", "loyalty", "fee", "tip"],
      required: true,
    },
    code: { type: String, default: "", trim: true, maxlength: 60 },
    // Id of the Coupon / Promotion behind the line, if any
    ref: { type: String, default: "", maxlength: 40 },
    label: { type: String, default: "", trim: true, maxlength: 120 },
    info: { type: String, default: "", trim: true, maxlength: 200 },
    amount: { type: Number, required: true },
    fundedBy: {
      type: String,
      enum: ["platform", "vendor"],
      required: true,
    },
    removable: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderFulfilmentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ["delivery", "collection"], default: "delivery" },
    // true = as soon as possible; false = booked into [slotStart, slotEnd)
    asap: { type: Boolean, default: true },
    slotStart: { type: Date, default: null, index: true },
    slotEnd: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    arrivalNote: { type: String, default: "", maxlength: 200 },
    collectedAt: { type: Date, default: null },
    // Set once when a cancelled order gives its slot back
    slotReleasedAt: { type: Date, default: null },
  },
  { _id: false }
);

// Who is delivering, and how it went (vendor-employed riders)
const orderDeliverySchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    riderName: { type: String, default: "" },
    assignedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    // Last position the rider shared (not a history)
    lastLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      at: { type: Date, default: null },
    },
    proof: {
      photoUrl: { type: String, default: "" },
      signatureSvg: { type: String, default: "", maxlength: 50000 },
      recipientName: { type: String, default: "", maxlength: 80 },
      ageVerified: { type: Boolean, default: false },
      idType: { type: String, default: "" },
    },
  },
  { _id: false }
);

// Money given back after the order was placed (unavailable or refused items)
const orderRefundSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "", maxlength: 300 },
    provider: { type: String, enum: ["stripe", "cod"], default: "stripe" },
    providerRef: { type: String, default: "" },
    status: { type: String, enum: ["succeeded", "failed", "not_charged"], default: "succeeded" },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
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
    // Pricing breakdown from lib/pricing.js. All integer pence.
    // total = subtotal + shippingFee - discountTotal + feeTotal + tipAmount
    priceLines: {
      type: [priceLineSchema],
      default: [],
    },
    discountTotal: { type: Number, default: 0, min: 0 },
    // Customer's instructions for this store
    customerNote: { type: String, default: "", trim: true, maxlength: 500 },
    allowSubstitutions: { type: Boolean, default: true },
    feeTotal: { type: Number, default: 0, min: 0 },
    tipAmount: { type: Number, default: 0, min: 0 },
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
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ORDER_STATUS,
      default: "pending",
      index: true,
    },
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
      // What the rate was applied to (lib/commissionUtils computeCommissionBase)
      base: { type: Number, default: null, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
      // What the store is owed for this order: base + tip - commission (pence).
      // Differs from total - commission once platform-funded discounts or
      // platform fees are on the order.
      vendorNet: { type: Number, default: null },
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
    fulfilment: {
      type: orderFulfilmentSchema,
      default: () => ({}),
    },
    delivery: {
      type: orderDeliverySchema,
      default: () => ({}),
    },
    // Highest age restriction among the items (0 = none); confirmed by the
    // customer at checkout and checked against ID on handover
    ageCheck: { type: Number, default: 0 },
    ageConfirmedAt: { type: Date, default: null },
    refunds: { type: [orderRefundSchema], default: [] },
    // Rewards points on this order (the loyalty price line holds their value)
    loyalty: {
      pointsRedeemed: { type: Number, default: 0, min: 0 },
      pointsEarned: { type: Number, default: 0, min: 0 },
      earnedAt: { type: Date, default: null },
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

orderSchema.pre("validate", function preValidateOrder() {
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
});

orderSchema.statics.ORDER_STATUS = ORDER_STATUS;
orderSchema.statics.COMPLETED_STATUSES = COMPLETED_STATUSES;
orderSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
orderSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
orderSchema.statics.SHIPMENT_EVENT_STATUSES = SHIPMENT_EVENT_STATUSES;

module.exports = mongoose.model("Order", orderSchema);
