/**
 * Demo data for the client app tour: three open London stores near
 * Trafalgar Square (postcode WC2N 5DU) with categories, photographed
 * products, discounts, a variant product and same-day delivery.
 *
 * Safe to re-run: removes the previous demo stores (and their vendors,
 * settings, shipping methods, categories and products) before inserting.
 *
 *   node seed-demo-tour.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const Store = require("./src/models/Store");
const StoreSettings = require("./src/models/StoreSettings");
const ShippingMethod = require("./src/models/ShippingMethod");
const Category = require("./src/models/Category");
const Product = require("./src/models/Product");

const img = (id) => `https://images.unsplash.com/photo-${id}?w=800&q=75&auto=format&fit=crop`;

const OPEN_ALL_WEEK = Object.fromEntries(
  ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => [
    day,
    { open: "00:00", close: "23:59", isClosed: false },
  ])
);

// Prices are in pence.
const STORES = [
  {
    slug: "demo-covent-garden-fresh",
    name: "Covent Garden Fresh Market",
    vendor: { name: "Priya Shah", email: "vendor.coventgarden@demo.co.uk" },
    description: "Fresh fruit, veg and everyday essentials from the heart of Covent Garden.",
    address: { line1: "12 Henrietta Street", city: "London", postalCode: "WC2E 8PS", country: "United Kingdom" },
    coordinates: [-0.1240, 51.5117],
    banner: img("1542838132-92c53300491e"),
    fee: 1.99,
    categories: {
      "Fruit & Veg": [
        ["British Bananas (5 pack)", 115, null, 120, "1571771894821-ce9b6c11b08e"],
        ["Pink Lady Apples (6 pack)", 250, 300, 80, "1560806887-1e4cd0b6cbd6"],
        ["Ripe & Ready Avocados (2 pack)", 199, null, 45, "1523049673857-eb18f1d7b578"],
        ["Scottish Strawberries 400g", 300, 375, 30, "1464965911861-746a04b4bca6"],
        ["Vine Tomatoes 500g", 175, null, 60, "1546094096-0df4bcaaa337"],
        ["Tenderstem Broccoli 200g", 160, null, 40, "1459411621453-7b03977f4bfc"],
        ["Unwaxed Lemons (4 pack)", 120, null, 50, "1590502593747-42a996133562"],
      ],
      "Dairy & Eggs": [
        ["Organic Whole Milk 2 Pints", 165, null, 70, "1563636619-e9143da7973b"],
        ["Free Range Eggs (12)", 349, 399, 35, "1582722872445-44dc5f7e3c8f"],
        ["Mature Cheddar 400g", 375, null, 25, "1486297678162-eb2a19b0a32d"],
        ["Greek Style Yoghurt 500g", 185, null, 30, "1488477181946-6428a0291777"],
        ["Salted British Butter 250g", 225, null, 40, "1589985270826-4b7bb135bc9d"],
      ],
    },
  },
  {
    slug: "demo-soho-bakery-deli",
    name: "Soho Corner Bakery & Deli",
    vendor: { name: "Marco Bellini", email: "vendor.soho@demo.co.uk" },
    description: "Bread baked every morning, pastries, deli cupboard staples and great coffee.",
    address: { line1: "48 Old Compton Street", city: "London", postalCode: "W1D 4UB", country: "United Kingdom" },
    coordinates: [-0.1318, 51.5136],
    banner: img("1509440159596-0249088772ff"),
    fee: 2.49,
    categories: {
      Bakery: [
        ["Sourdough Loaf", 349, 425, 20, "1509440159596-0249088772ff", {
          option: "Size",
          variants: [["400g", 349, 425, 12], ["800g", 549, null, 8]],
        }],
        ["All-Butter Croissants (4 pack)", 295, null, 24, "1555507036-ab1f4038808a"],
        ["Chocolate Chip Cookies (6)", 250, null, 30, "1499636136210-6f4ee915583e"],
      ],
      "Tinned & Cupboard": [
        ["Italian Penne Pasta 500g", 135, null, 60, "1551462147-ff29053bfc14"],
        ["Basmati Rice 1kg", 299, 349, 40, "1586201375761-83865001e31c"],
        ["Extra Virgin Olive Oil 500ml", 549, null, 25, "1474979266404-7eaacbcd87c5"],
      ],
      "Tea & Coffee": [
        ["Single Origin Coffee Beans 250g", 650, 795, 18, "1559056199-641a0ac8b55e"],
      ],
    },
  },
  {
    slug: "demo-strand-express",
    name: "Strand Express Grocer",
    vendor: { name: "Tariq Mahmood", email: "vendor.strand@demo.co.uk" },
    description: "Your all-day convenience store: drinks, snacks and household basics.",
    address: { line1: "390 Strand", city: "London", postalCode: "WC2R 0LT", country: "United Kingdom" },
    coordinates: [-0.1205, 51.5101],
    banner: img("1604719312566-8912e9227c6a"),
    fee: 0,
    categories: {
      Drinks: [
        ["Freshly Squeezed Orange Juice 1L", 275, 325, 30, "1600271886742-f049cd451bba"],
        ["Sparkling Spring Water 6 x 500ml", 299, null, 50, "1523362628745-0c100150b504"],
        ["Classic Cola 330ml (6 pack)", 450, 525, 40, "1622483767028-3f66f32aef97"],
      ],
      "Snacks & Sweets": [
        ["Dark Chocolate Bar 100g", 199, null, 60, "1606312619070-d48b4c652a52"],
        ["Sea Salt Crisps 150g", 165, 199, 45, "1566478989037-eec170784d0b"],
      ],
      Household: [
        ["Eco Laundry Liquid 1.5L", 650, 750, 20, "1583947215259-38e31be8751f"],
        ["Soft Toilet Tissue (9 rolls)", 499, null, 25, "1584556812952-905ffd0c611a"],
      ],
    },
  },
];

const slugify = (text) =>
  text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");

async function removePrevious() {
  const slugs = STORES.map((s) => s.slug);
  const old = await Store.find({ slug: { $in: slugs } }).select("_id");
  const ids = old.map((s) => s._id);
  await Promise.all([
    Product.deleteMany({ store: { $in: ids } }),
    Category.deleteMany({ store: { $in: ids } }),
    ShippingMethod.deleteMany({ store: { $in: ids } }),
    StoreSettings.deleteMany({ store: { $in: ids } }),
  ]);
  await Store.deleteMany({ _id: { $in: ids } });
  await User.deleteMany({ email: { $in: STORES.map((s) => s.vendor.email) } });
}

async function seedStore(def) {
  const vendor = await User.create({
    name: def.vendor.name,
    email: def.vendor.email,
    password: "password123",
    role: "vendor",
    status: "active",
  });

  const store = await Store.create({
    name: def.name,
    slug: def.slug,
    owner: vendor._id,
    description: def.description,
    status: "active",
    contact: { phone: "+44 20 7946 0000", email: def.vendor.email },
    address: def.address,
    location: { type: "Point", coordinates: def.coordinates },
    locationSet: true,
    deliveryRadiusKm: 5,
    timezone: "Europe/London",
    operatingHours: OPEN_ALL_WEEK,
  });

  vendor.storeId = store._id;
  await vendor.save();

  await StoreSettings.create({
    store: store._id,
    branding: { displayName: def.name, bannerUrl: def.banner },
    shipping: { flatFee: def.fee, freeShippingThreshold: 15 },
  });

  await ShippingMethod.create({
    store: store._id,
    code: "same-day",
    name: "Same-day local delivery",
    description: "Delivered today by our local rider",
    fee: def.fee,
    minDays: 0,
    maxDays: 0,
    isActive: true,
    sortOrder: 0,
  });

  let productCount = 0;
  for (const [categoryName, products] of Object.entries(def.categories)) {
    const category = await Category.create({
      store: store._id,
      name: categoryName,
      slug: slugify(categoryName),
      isActive: true,
    });

    for (const [title, price, compareAtPrice, stock, photo, variantDef] of products) {
      const doc = {
        store: store._id,
        title,
        slug: slugify(title),
        description: `${title} from ${def.name}. Picked and packed fresh for same-day delivery.`,
        price,
        compareAtPrice,
        stock,
        category: category._id,
        images: [img(photo)],
        isActive: true,
      };
      if (variantDef) {
        doc.options = [{ name: variantDef.option, values: variantDef.variants.map((v) => v[0]) }];
        doc.variants = variantDef.variants.map(([value, vPrice, vCompare, vStock]) => ({
          sku: `${slugify(title)}-${slugify(value)}`,
          attributes: { [variantDef.option]: value },
          price: vPrice,
          compareAtPrice: vCompare,
          stock: vStock,
          images: [img(photo)],
          isActive: true,
        }));
      }
      await Product.create(doc);
      productCount += 1;
    }
  }

  return { store, productCount };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await removePrevious();
  for (const def of STORES) {
    const { store, productCount } = await seedStore(def);
    console.log(`✓ ${store.name} (${store.slug}) — ${productCount} products`);
  }
  console.log("Vendor logins use password: password123");
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
