/**
 * App-level plumbing.
 *   GET  /app/config?platform=ios|android&version=1.2.3   (public) version gate + feature switches
 *   GET  /banners?lat=&lng=                               (public) home banners for here and now
 *   GET  /address/lookup?postcode=                        (signed in) addresses for a postcode
 *   POST /me/account/delete-code   POST /me/account/delete   (customer) close account
 *   GET  /me/payment-methods       DELETE /me/payment-methods/:id   saved cards
 *   Admin: /admin/banners CRUD
 */
const mongoose = require("mongoose");
const ApiError = require("../lib/ApiError");
const asyncHandler = require("../lib/asyncHandler");
const Banner = require("../models/Banner");
const PlatformSettings = require("../models/PlatformSettings");
const User = require("../models/User");
const { haversineKm } = require("../lib/geoUtils");
const { isLookupEnabled, lookupPostcode } = require("../lib/postcode");
const { confirmDeletion, requestDeletion } = require("../lib/accountDeletion");
const { sendEmail } = require("../lib/emailClient");
const { getStripeClient, isStripeConfigured } = require("../lib/stripeClient");
const { loyaltyConfig } = require("../lib/loyalty");

/* ── Version gate ────────────────────────────────────────────────────── */

const parseVersion = (v) => {
  const m = String(v || "").trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : null;
};
const compareVersions = (a, b) => {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
};

const getAppConfig = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getOrInit();
  const app = settings.app || {};
  const version = String(req.query.version || "");
  const platform = req.query.platform === "ios" ? "ios" : "android";

  let update = "none";
  if (version && app.minVersion && compareVersions(version, app.minVersion) < 0) update = "required";
  else if (version && app.latestVersion && compareVersions(version, app.latestVersion) < 0) update = "soft";

  res.status(200).json({
    data: {
      update,
      minVersion: app.minVersion || "0.0.0",
      latestVersion: app.latestVersion || "",
      storeUrl: platform === "ios" ? app.iosUrl || "" : app.androidUrl || "",
      message: app.message || "",
      features: {
        addressLookup: isLookupEnabled(),
        rewards: loyaltyConfig(settings).enabled,
        cardPayments: settings.features?.onlinePaymentEnabled !== false && isStripeConfigured(),
        cashOnDelivery: settings.features?.codEnabled !== false,
      },
    },
  });
});

/* ── Banners ─────────────────────────────────────────────────────────── */

const isLiveNow = (b, now) =>
  b.isActive && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now);

const listBanners = asyncHandler(async (req, res) => {
  const now = new Date();
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasHere = Number.isFinite(lat) && Number.isFinite(lng);
  const all = await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).limit(50).lean();
  const shown = all.filter((b) => {
    if (!isLiveNow(b, now)) return false;
    if (b.geo?.lat == null || b.geo?.lng == null || !b.geo?.radiusKm) return true;
    // Location campaigns only show to customers inside their area
    return hasHere && haversineKm(lat, lng, b.geo.lat, b.geo.lng) <= b.geo.radiusKm;
  });
  res.status(200).json({ data: shown.slice(0, 10) });
});

const bannerFields = (body, file) => {
  const out = {};
  for (const k of ["title", "subtitle", "isActive", "sortOrder", "startsAt", "endsAt"]) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (typeof out.isActive === "string") out.isActive = out.isActive === "true";
  if (out.sortOrder !== undefined) out.sortOrder = Number(out.sortOrder) || 0;
  for (const d of ["startsAt", "endsAt"]) if (out[d] !== undefined) out[d] = out[d] ? new Date(out[d]) : null;
  if (body.targetType !== undefined) out["target.type"] = body.targetType;
  if (body.targetValue !== undefined) out["target.value"] = String(body.targetValue).trim();
  for (const g of ["lat", "lng", "radiusKm"]) {
    if (body[g] !== undefined) out[`geo.${g}`] = body[g] === "" || body[g] === null ? null : Number(body[g]);
  }
  if (file?.location) out.imageUrl = file.location;
  else if (body.imageUrl !== undefined) out.imageUrl = String(body.imageUrl).trim();
  return out;
};

const validateBanner = (doc) => {
  if (!doc.title || String(doc.title).trim().length < 2) throw new ApiError(400, "Give the banner a title");
  const t = doc.target?.type;
  if (t === "url" && !/^https:\/\//.test(doc.target.value || "")) throw new ApiError(400, "Links must start with https://");
  if (["store", "category", "coupon"].includes(t) && !doc.target.value) throw new ApiError(400, "Say which store, category or code it opens");
  const g = doc.geo || {};
  const geoSet = [g.lat, g.lng, g.radiusKm].filter((x) => x != null).length;
  if (geoSet && geoSet < 3) throw new ApiError(400, "An area needs a latitude, longitude and radius");
  if (doc.startsAt && doc.endsAt && doc.endsAt <= doc.startsAt) throw new ApiError(400, "End date must be after the start");
};

const adminListBanners = asyncHandler(async (req, res) => {
  res.status(200).json({ data: await Banner.find().sort({ sortOrder: 1, createdAt: -1 }).lean() });
});

const adminCreateBanner = asyncHandler(async (req, res) => {
  const banner = new Banner();
  banner.set(bannerFields(req.body || {}, req.file));
  validateBanner(banner.toObject());
  await banner.save();
  res.status(201).json({ message: "Banner created", data: banner });
});

const adminUpdateBanner = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new ApiError(404, "Banner not found");
  banner.set(bannerFields(req.body || {}, req.file));
  validateBanner(banner.toObject());
  await banner.save();
  res.status(200).json({ message: "Banner updated", data: banner });
});

const adminDeleteBanner = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid id");
  await Banner.deleteOne({ _id: req.params.id });
  res.status(200).json({ message: "Banner deleted" });
});

/* ── Address lookup ──────────────────────────────────────────────────── */

const addressLookup = asyncHandler(async (req, res) => {
  try {
    const result = await lookupPostcode(req.query.postcode);
    if (result.invalid) throw new ApiError(400, "That doesn't look like a UK postcode");
    res.status(200).json({ data: result });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Provider down: the app falls back to typing the address in
    res.status(200).json({ data: { enabled: true, addresses: [], unavailable: true } });
  }
});

/* ── Account deletion ────────────────────────────────────────────────── */

const requestAccountDeletion = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "Account not found");
  await requestDeletion(user, { sendEmail });
  res.status(200).json({ message: `We've emailed a code to ${user.email}` });
});

const confirmAccountDeletion = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "Enter the 6-digit code from the email");
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "Account not found");
  await confirmDeletion(user, code);
  res.status(200).json({ message: "Your account has been deleted" });
});

/* ── Saved cards ─────────────────────────────────────────────────────── */

const customerIdOf = async (userId) => (await User.findById(userId).select("+stripeCustomerId"))?.stripeCustomerId || "";

const listPaymentMethods = asyncHandler(async (req, res) => {
  const customer = await customerIdOf(req.user.id);
  if (!customer || !isStripeConfigured()) return res.status(200).json({ data: [] });
  const list = await getStripeClient().paymentMethods.list({ customer, type: "card" });
  return res.status(200).json({
    data: (list.data || []).map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || "",
      last4: pm.card?.last4 || "",
      expMonth: pm.card?.exp_month || null,
      expYear: pm.card?.exp_year || null,
    })),
  });
});

const removePaymentMethod = asyncHandler(async (req, res) => {
  const customer = await customerIdOf(req.user.id);
  if (!customer || !isStripeConfigured()) throw new ApiError(404, "Card not found");
  const stripe = getStripeClient();
  const pm = await stripe.paymentMethods.retrieve(req.params.id).catch(() => null);
  // Only ever detach a card that belongs to this customer
  if (!pm || pm.customer !== customer) throw new ApiError(404, "Card not found");
  await stripe.paymentMethods.detach(pm.id);
  res.status(200).json({ message: "Card removed" });
});

module.exports = {
  compareVersions,
  getAppConfig,
  listBanners,
  adminListBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  addressLookup,
  requestAccountDeletion,
  confirmAccountDeletion,
  listPaymentMethods,
  removePaymentMethod,
};
