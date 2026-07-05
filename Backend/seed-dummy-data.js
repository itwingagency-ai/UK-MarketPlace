require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const Store = require("./src/models/Store");
const Product = require("./src/models/Product");
const ShippingMethod = require("./src/models/ShippingMethod");
const StoreSettings = require("./src/models/StoreSettings");

const seedDummyData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");
    console.log("Connected to MongoDB");

    // 1. Fetch the Vendor User
    const vendorEmail = "testuser1@store.com";
    let vendor = await User.findOne({ email: vendorEmail });
    if (!vendor) {
      console.error(`Vendor user with email ${vendorEmail} not found. Please create it first.`);
      return;
    }
    console.log(`Found vendor: ${vendor.email}`);

    // 2. Fetch the Store
    let store = await Store.findOne({ owner: vendor._id });
    if (!store) {
      console.error("Store not found for this vendor. Please create a store first.");
      return;
    }
    console.log(`Found store: ${store.name} (${store._id})`);

    // 3. Fetch a Product
    let product = await Product.findOne({ store: store._id });
    if (!product) {
      console.error("No product found for this store. Please add a product first.");
      return;
    }
    console.log(`Found product: ${product.title} (${product._id})`);
    
    let variantId = null;
    if (product.variants && product.variants.length > 0) {
      variantId = product.variants[0]._id;
      console.log(`Found variant: ${variantId}`);
    } else {
      console.warn("Warning: Product has no variants.");
    }

    // 4. Fetch a Shipping Method
    let shipping = await ShippingMethod.findOne({ store: store._id });
    if (!shipping) {
      console.error("No shipping method found for this store. Please add a shipping method first.");
      return;
    }
    console.log(`Found shipping method: ${shipping.name} (${shipping._id})`);

    // 5. Create or Fetch a Customer User
    let customer = await User.findOne({ email: "customer@marketplace.co.uk" });
    if (!customer) {
      customer = await User.create({
        name: "Test Customer",
        email: "customer@marketplace.co.uk",
        password: "password123",
        role: "customer",
        status: "active",
      });
      console.log("Customer user created.");
    } else {
      console.log("Customer user already exists.");
    }

    console.log("\n--- DYNAMIC DATA FETCHED AND SEEDED SUCCESSFULLY ---");
    console.log("Customer Email: customer@marketplace.co.uk");
    console.log("Customer Password: password123");
    
    console.log("\n--- Use this payload for /api/v1/cart/items ---");
    console.log(JSON.stringify({
      productId: product._id,
      variantId: variantId,
      quantity: 1
    }, null, 2));

    console.log("\n--- Use this payload for /api/v1/checkout ---");
    console.log(JSON.stringify({
      shippingAddress: {
        fullName: "Test Customer",
        line1: "Pasrur road, Fareed Town",
        city: "Lahore",
        postalCode: "52132",
        country: "Pakistan"
      },
      paymentMethod: "cod",
      shippingSelections: [
        {
          storeId: store._id,
          shippingMethodId: shipping._id
        }
      ]
    }, null, 2));
    
  } catch (error) {
    console.error("Error seeding dummy data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

seedDummyData();
