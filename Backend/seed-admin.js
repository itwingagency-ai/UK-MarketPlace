require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");
    console.log("Connected to MongoDB");

    // Pull credentials from environment variables instead of hardcoding
    const adminEmail = process.env.SUPERADMIN_EMAIL || "superadmin@marketplace.co.uk";
    const adminPassword = process.env.SUPERADMIN_PASSWORD || "abdullah2@12";

    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      // Best practice: Do NOT overwrite the password if the user already exists.
      // They might have changed it securely through the app.
      console.log(`User ${adminEmail} already exists. Skipping password reset for security.`);
    } else {
      await User.create({
        name: "Super Admin",
        email: adminEmail,
        password: adminPassword,
        role: "admin",
        status: "active",
      });
      console.log(`User ${adminEmail} created and password hashed successfully!`);
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedAdmin();
