/**
 * Closing a customer account (required by the App Store and Google Play).
 *
 * Two steps: request a 6-digit code by email, then confirm with it. The code
 * is stored hashed and expires in 10 minutes.
 *
 * On confirm:
 *   - personal data is removed from the user record (name, email, phone,
 *     addresses, devices, sign-in methods) and the account can't sign in;
 *   - orders are KEPT for accounting and tax, but the name, email, phone and
 *     delivery address on them are blanked;
 *   - basket, sessions, notification settings, stock alerts and in-app
 *     notifications are deleted; the points balance is forfeited;
 *   - reviews stay, shown as "Deleted user".
 * Only customers can do this themselves: shop owners and riders go through
 * the store/support, because a store and its orders depend on them.
 */
const crypto = require("crypto");
const ApiError = require("./ApiError");

const OPEN_STATUSES = ["pending", "confirmed", "packed", "shipped", "ready_for_collection"];
const hash = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

/* eslint-disable global-require */
const models = () => ({
  User: require("../models/User"),
  Order: require("../models/Order"),
  Otp: require("../models/Otp"),
  Cart: require("../models/Cart"),
  RefreshToken: require("../models/RefreshToken"),
  NotificationPreference: require("../models/NotificationPreference"),
  StockAlert: require("../models/StockAlert"),
  Notification: require("../models/Notification"),
  LoyaltyAccount: require("../models/LoyaltyAccount"),
});
/* eslint-enable global-require */

const assertDeletable = async (user) => {
  const { Order } = models();
  if (user.role !== "customer") {
    throw new ApiError(409, "Shop and rider accounts are closed through support, so your store's orders stay intact");
  }
  if (await Order.exists({ customer: user._id, orderStatus: { $in: OPEN_STATUSES } })) {
    throw new ApiError(409, "You have an order in progress. Please wait for it to finish, or cancel it, then try again");
  }
};

/** Send the code. Returns the plain code only so tests can use it. */
const requestDeletion = async (user, { sendEmail }) => {
  const { Otp } = models();
  await assertDeletable(user);
  const code = String(crypto.randomInt(100000, 1000000));
  await Otp.deleteMany({ email: user.email, purpose: "delete_account" });
  await Otp.create({ email: user.email, otp: hash(code), purpose: "delete_account" });
  await sendEmail({
    to: user.email,
    subject: "Your account deletion code",
    body: `Your code to delete your account is ${code}. It expires in 10 minutes. If you didn't ask for this, ignore this email and change your password.`,
  });
  return code;
};

const confirmDeletion = async (user, code) => {
  const m = models();
  await assertDeletable(user);
  const otp = await m.Otp.findOne({ email: user.email, purpose: "delete_account", otp: hash(code) });
  if (!otp) throw new ApiError(400, "That code is wrong or has expired");

  const placeholder = `deleted-${user._id}@deleted.invalid`;
  const blankAddress = { fullName: "Deleted user", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "", lat: null, lng: null };

  await m.Order.updateMany(
    { customer: user._id },
    {
      $set: {
        "customerSnapshot.name": "Deleted user",
        "customerSnapshot.email": "",
        "customerSnapshot.phone": "",
        shippingAddress: blankAddress,
        customerNote: "",
        "fulfilment.arrivalNote": "",
        "delivery.proof.recipientName": "",
        "delivery.proof.photoUrl": "",
      },
    }
  );

  await m.User.updateOne(
    { _id: user._id },
    {
      $set: {
        name: "Deleted user",
        email: placeholder,
        phone: "",
        password: crypto.randomBytes(32).toString("hex"), // not a bcrypt hash: can never match
        status: "deleted",
        addresses: [],
        pushTokens: [],
        favoriteStores: [],
        favoriteProducts: [],
        deletedAt: new Date(),
      },
      $unset: { googleId: 1, referralCode: 1, stripeCustomerId: 1 },
    }
  );

  await Promise.all([
    m.Otp.deleteMany({ email: user.email }),
    m.Cart.deleteMany({ user: user._id }),
    m.RefreshToken.deleteMany({ user: user._id }),
    m.NotificationPreference.deleteMany({ user: user._id }),
    m.StockAlert.deleteMany({ user: user._id }),
    m.Notification.deleteMany({ $or: [{ user: user._id }, { recipient: user._id }] }),
  ]);

  // Forfeit points through the ledger, so the balance still equals its history
  const account = await m.LoyaltyAccount.findOne({ user: user._id }).lean();
  if (account?.balance > 0) {
    // eslint-disable-next-line global-require
    await require("./loyalty").postEntry({
      user: user._id,
      type: "adjust",
      points: -account.balance,
      key: `account-deleted:${user._id}`,
      note: "Account deleted",
      clampToBalance: true,
    });
  }
};

module.exports = { requestDeletion, confirmDeletion, hash, OPEN_STATUSES };
