require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const Store = require("./src/models/Store");
const Product = require("./src/models/Product");
const Review = require("./src/models/Review");
const Order = require("./src/models/Order");

const seedReviews = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");
    console.log("Connected to MongoDB");

    // Get a customer
    let customer = await User.findOne({ email: "customer@marketplace.co.uk" });
    if (!customer) {
      console.log("Customer not found. Creating one...");
      customer = await User.create({
        name: "Test Customer",
        email: "customer@marketplace.co.uk",
        password: "password123",
        role: "customer",
        status: "active",
      });
    }

    // Get another customer
    let customer2 = await User.findOne({ email: "customer2@marketplace.co.uk" });
    if (!customer2) {
      console.log("Customer2 not found. Creating one...");
      customer2 = await User.create({
        name: "Second Customer",
        email: "customer2@marketplace.co.uk",
        password: "password123",
        role: "customer",
        status: "active",
      });
    }

    // Get some products
    const products = await Product.find().limit(3);
    if (!products.length) {
      console.error("No products found to review. Please add a product first.");
      return;
    }

    console.log(`Found ${products.length} products to review.`);

    // Clear existing reviews
    await Review.deleteMany({});
    console.log("Cleared existing reviews.");

    // Create reviews
    const reviewsToCreate = [
      {
        product: products[0]._id,
        store: products[0].store,
        user: customer._id,
        rating: 5,
        title: "Excellent Product!",
        body: "I absolutely loved this product. Highly recommended.",
        status: "approved",
        isVerifiedPurchase: true,
        userSnapshot: { name: customer.name }
      },
      {
        product: products[0]._id,
        store: products[0].store,
        user: customer2._id,
        rating: 4,
        title: "Very good, but shipping was slow",
        body: "The quality is great, but it took a while to arrive.",
        status: "pending",
        isVerifiedPurchase: false,
        userSnapshot: { name: customer2.name }
      }
    ];

    if (products.length > 1) {
      reviewsToCreate.push({
        product: products[1]._id,
        store: products[1].store,
        user: customer._id,
        rating: 2,
        title: "Not what I expected",
        body: "The color is different from the pictures.",
        status: "rejected",
        moderation: { reason: "Inappropriate language", byRole: "admin", reviewedAt: new Date() },
        isVerifiedPurchase: true,
        userSnapshot: { name: customer.name }
      });
    }

    if (products.length > 2) {
      reviewsToCreate.push({
        product: products[2]._id,
        store: products[2].store,
        user: customer2._id,
        rating: 1,
        title: "Terrible",
        body: "Broke after 2 days.",
        status: "approved",
        isVerifiedPurchase: true,
        userSnapshot: { name: customer2.name }
      });
    }

    await Review.insertMany(reviewsToCreate);
    console.log(`Successfully seeded ${reviewsToCreate.length} reviews.`);

  } catch (error) {
    console.error("Error seeding reviews:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedReviews();
