require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");
    console.log("Connected to MongoDB");

    const admins = [
      {
        name: "Super Admin",
        email: "superadmin@marketplace.co.uk",
        password: "abdullah2@12",
        role: "admin",
        status: "active",
      }
    ];

    for (const adminData of admins) {
      let adminUser = await User.findOne({ email: adminData.email });

      if (adminUser) {
        console.log(`User ${adminData.email} already exists. Updating password...`);
        adminUser.password = adminData.password;
        await adminUser.save(); // The pre-save hook in User model will hash the password automatically
        console.log(`Password for ${adminData.email} updated and hashed successfully!`);
      } else {
        await User.create(adminData); // The pre-save hook hashes the password on creation
        console.log(`User ${adminData.email} created and password hashed successfully!`);
      }
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedAdmin();
