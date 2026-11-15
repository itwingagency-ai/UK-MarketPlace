/**
 * A three-store marketplace used by the checkout-totals tests.
 *
 * Units, as stored in production:
 *   - product / variant prices: integer pence
 *   - ShippingMethod.fee, StoreSettings.shipping.*: pounds (converted at pricing time)
 *
 * Store A "alpha"   methods: standard £2.50 (default), express £5.50; free over £30
 *   P1 Bread                450p  stock 10
 *   P2 Coffee (variants)    250g 899p / 1kg 1299p  stock 5 each
 * Store B "bravo"   no methods, flat fee £3.50 from StoreSettings
 *   P3 Milk                 250p  stock 20
 * Store C "charlie" no methods, no settings -> free delivery
 *   P4 Gum                  199p  stock 3
 */
const path = require("path");
const { SRC } = require("./harness");

const model = (name) => require(path.join(SRC, "models", name)); // eslint-disable-line global-require

const ADDRESS = {
  fullName: "Test Customer",
  phone: "07000000000",
  line1: "1 Test Street",
  city: "London",
  postalCode: "E1 6AN",
  country: "UK",
};

let counter = 0;
const uniq = (p) => {
  counter += 1;
  return `${p}${counter}`;
};

const makeUser = async (overrides = {}) => {
  const User = model("User");
  return User.create({
    name: "Test User",
    email: `${uniq("user")}@example.test`,
    password: "password1234",
    role: "customer",
    status: "active",
    ...overrides,
  });
};

const makeStore = async (name, extra = {}) => {
  const Store = model("Store");
  const owner = await makeUser({ role: "vendor", name: `${name} owner` });
  const store = await Store.create({ name, slug: uniq(name), owner: owner._id, ...extra });
  owner.storeId = store._id;
  await owner.save();
  return store;
};

const tokenFor = (user) =>
  require(path.join(SRC, "lib", "jwt")).signAccessToken(user); // eslint-disable-line global-require

const seedMarketplace = async () => {
  const Product = model("Product");
  const ShippingMethod = model("ShippingMethod");
  const StoreSettings = model("StoreSettings");

  const alpha = await makeStore("alpha");
  const bravo = await makeStore("bravo");
  const charlie = await makeStore("charlie");

  const standard = await ShippingMethod.create({
    store: alpha._id, name: "Standard", code: "standard", fee: 2.5, sortOrder: 0,
  });
  const express = await ShippingMethod.create({
    store: alpha._id, name: "Express", code: "express", fee: 5.5, sortOrder: 1,
  });
  await StoreSettings.create({
    store: alpha._id, shipping: { flatFee: 1, freeShippingThreshold: 30 },
  });
  await StoreSettings.create({
    store: bravo._id, shipping: { flatFee: 3.5, freeShippingThreshold: 0 },
  });

  const bread = await Product.create({
    store: alpha._id, title: "Bread", slug: "bread", price: 450, stock: 10,
  });
  const coffee = await Product.create({
    store: alpha._id,
    title: "Coffee",
    slug: "coffee",
    price: 899,
    stock: 0,
    options: [{ name: "Size", values: ["250g", "1kg"] }],
    variants: [
      { sku: "COF-250", attributes: { Size: "250g" }, price: 899, stock: 5 },
      { sku: "COF-1K", attributes: { Size: "1kg" }, price: 1299, stock: 5 },
    ],
  });
  const milk = await Product.create({
    store: bravo._id, title: "Milk", slug: "milk", price: 250, stock: 20,
  });
  const gum = await Product.create({
    store: charlie._id, title: "Gum", slug: "gum", price: 199, stock: 3,
  });

  const customer = await makeUser();
  return {
    stores: { alpha, bravo, charlie },
    methods: { standard, express },
    products: { bread, coffee, milk, gum },
    coffee250: coffee.variants[0],
    coffee1k: coffee.variants[1],
    customer,
    token: tokenFor(customer),
  };
};

/** The cart every "existing cart" test starts from. */
const fillStandardCart = async (h, m) => {
  const add = (productId, quantity, variantId) =>
    h.api("POST", "/api/v1/cart/items", {
      token: m.token,
      body: { productId: String(productId), quantity, ...(variantId ? { variantId: String(variantId) } : {}) },
    });
  const results = [
    await add(m.products.bread._id, 2),
    await add(m.products.coffee._id, 1, m.coffee250._id),
    await add(m.products.milk._id, 3),
    await add(m.products.gum._id, 1),
  ];
  for (const r of results) {
    if (r.status !== 200) throw new Error(`add to cart failed: ${r.status} ${r.text}`);
  }
  return results[results.length - 1].body.data;
};

const checkoutBody = (extra = {}) => ({
  shippingAddress: ADDRESS,
  lat: 51.52,
  lng: -0.07,
  paymentMethod: "cod",
  ...extra,
});

module.exports = {
  model,
  makeUser,
  makeStore,
  tokenFor,
  seedMarketplace,
  fillStandardCart,
  checkoutBody,
  ADDRESS,
};
