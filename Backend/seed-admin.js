require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/uk_marketplace");
    console.log("Connected to MongoDB");

    const email = "admin@marketplace.co.uk";
    
    let adminUser = await User.findOne({ email });
    
    if (adminUser) {
      console.log("Admin user already exists");
    } else {
      adminUser = await User.create({
        name: "Super Admin",
        email: email,
        password: "password123", // Will be hashed by pre-save hook
        role: "admin",
        status: "active",
      });
      console.log("Admin user created successfully!");
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedAdmin();
