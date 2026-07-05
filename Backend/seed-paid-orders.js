require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("./src/models/Order");
const User = require("./src/models/User");
const Store = require("./src/models/Store");
const Product = require("./src/models/Product");
const PlatformSettings = require("./src/models/PlatformSettings");
const { resolveCommissionConfig, buildCommissionSnapshot } = require("./src/lib/commissionUtils");

const seedOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");
    console.log("Connected to MongoDB");

    // Get basic entities
    const customer = await User.findOne({ email: "customer@marketplace.co.uk" }) || await User.findOne({ role: "customer" });
    const vendor = await User.findOne({ email: "testuser1@store.com" });
    const store = await Store.findOne({ owner: vendor._id });
    const product = await Product.findOne({ store: store._id });
    const platform = await PlatformSettings.getOrInit();

    if (!customer || !store || !product) {
        console.error("Missing required dummy data (customer, store, product). Run seed-dummy-data.js first.");
        return;
    }

    // Determine the precise commission config exactly how checkout does it
    const config = resolveCommissionConfig(store, platform);

    const newOrders = [];
    for (let i = 1; i <= 2; i++) {
      const orderTotal = product.price + 5; // Price + shipping
      
      // Build the exact same snapshot a real order gets
      const commissionSnapshot = buildCommissionSnapshot(config, orderTotal);

      const order = new Order({
        store: store._id,
        customer: customer._id,
        customerSnapshot: {
          name: customer.name,
          email: customer.email,
        },
        items: [
          {
            product: product._id,
            title: product.title,
            quantity: 1,
            unitPrice: product.price,
            total: product.price,
          },
        ],
        subtotal: product.price,
        shippingFee: 5,
        total: orderTotal,
        paymentStatus: "paid",
        orderStatus: "delivered",
        commission: commissionSnapshot,
      });
      newOrders.push(order);
    }

    await Order.insertMany(newOrders);
    console.log(`Seeded ${newOrders.length} paid orders with precise commission logic applied!`);

  } catch (error) {
    console.error("Error seeding orders:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedOrders();
