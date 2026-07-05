require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");
const Review = require("./src/models/Review");
const ReviewReport = require("./src/models/ReviewReport");

const seedReportedReviews = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");
    console.log("Connected to MongoDB");

    // Clear existing reports
    await ReviewReport.deleteMany({});
    console.log("Cleared existing reports.");

    const reviews = await Review.find().limit(3);
    if (!reviews.length) {
      console.log("No reviews found. Please run seed-reviews.js first.");
      return;
    }

    const customer = await User.findOne({ email: "customer@marketplace.co.uk" });
    const customer2 = await User.findOne({ email: "customer2@marketplace.co.uk" });

    if (!customer || !customer2) {
      console.log("Customers not found.");
      return;
    }

    const reportsToCreate = [
      {
        review: reviews[0]._id,
        reportedBy: customer2._id, // User 2 reports User 1's review
        reason: "spam",
        note: "This looks like a fake automated review.",
        status: "pending"
      }
    ];

    if (reviews.length > 1) {
      reportsToCreate.push({
        review: reviews[1]._id,
        reportedBy: customer._id,
        reason: "abusive",
        note: "The user used inappropriate language.",
        status: "pending"
      });
    }

    if (reviews.length > 2) {
      reportsToCreate.push({
        review: reviews[2]._id,
        reportedBy: customer._id,
        reason: "off_topic",
        note: "Review is about a completely different product.",
        status: "dismissed",
        resolution: "User is just confused, no action needed."
      });
    }

    await ReviewReport.insertMany(reportsToCreate);
    console.log(`Successfully seeded ${reportsToCreate.length} review reports.`);

  } catch (error) {
    console.error("Error seeding review reports:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedReportedReviews();
