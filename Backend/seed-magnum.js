const mongoose = require("mongoose");
require("dotenv").config();

const Store = require("./src/models/Store");
const Category = require("./src/models/Category");
const Product = require("./src/models/Product");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore";

const seedMagnumProducts = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    const User = require("./src/models/User");
    const vendor = await User.findOne({ email: "testuser1@store.com" });
    if (!vendor) {
      console.log("Vendor testuser1@store.com not found!");
      process.exit(1);
    }
    const store = await Store.findOne({ owner: vendor._id });
    if (!store) {
      console.log("No store found!");
      process.exit(1);
    }

    // Create Category
    let category = await Category.findOne({ name: "Magnum Ice Cream", store: store._id });
    if (!category) {
      category = await Category.create({
        store: store._id,
        name: "Magnum Ice Cream",
        slug: "magnum-ice-cream",
        image: "https://images.unsplash.com/photo-1570197571499-166b36435e9f?q=80&w=500"
      });
      console.log("Created category: Magnum Ice Cream");
    } else {
      console.log("Category already exists.");
    }

    // Delete existing magnum products just in case
    await Product.deleteMany({ category: category._id });

    // Seed 4 Products
    const products = [
      {
        store: store._id,
        category: category._id,
        title: "Magnum Classic Ice Cream",
        slug: "magnum-classic",
        description: "207 kcal/100ml", // Using description to hold nutrition info for now
        price: 200, // stored in pence
        compareAtPrice: 250,
        stock: 50,
        images: ["https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop"]
      },
      {
        store: store._id,
        category: category._id,
        title: "Magnum Double Caramel",
        slug: "magnum-double-caramel",
        description: "239 kcal/100ml",
        price: 225,
        compareAtPrice: 265,
        stock: 45,
        images: ["https://images.unsplash.com/photo-1580915411954-282cb1b0d780?q=80&w=400&auto=format&fit=crop"]
      },
      {
        store: store._id,
        category: category._id,
        title: "Magnum Gold Billionaire",
        slug: "magnum-gold-billionaire",
        description: "232 kcal/100ml",
        price: 240,
        compareAtPrice: 300,
        stock: 30,
        images: ["https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=400&auto=format&fit=crop"]
      },
      {
        store: store._id,
        category: category._id,
        title: "Magnum Classic Sticks",
        slug: "magnum-classic-sticks",
        description: "210 kcal/100ml",
        price: 375,
        compareAtPrice: 420,
        stock: 20,
        images: ["https://images.unsplash.com/photo-1628198751508-3a985f470a1a?q=80&w=400&auto=format&fit=crop"]
      }
    ];

    await Product.insertMany(products);
    console.log("Created 4 Magnum Ice Cream products with images.");

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

seedMagnumProducts();
