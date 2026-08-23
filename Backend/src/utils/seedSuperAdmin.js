const User = require("../models/User");

const seedSuperAdmin = async () => {
  try {
    const adminEmail = process.env.SUPERADMIN_EMAIL || "superadmin@marketplace.co.uk";
    const adminPassword = process.env.SUPERADMIN_PASSWORD || "abdullah2@12";

    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      console.log(`[Seed] Super admin (${adminEmail}) already exists. Skipping creation.`);
    } else {
      await User.create({
        name: "Super Admin",
        email: adminEmail,
        password: adminPassword,
        role: "admin",
        status: "active",
      });
      console.log(`[Seed] Super admin (${adminEmail}) created successfully!`);
    }
  } catch (error) {
    console.error("[Seed] Error seeding super admin:", error);
  }
};

module.exports = seedSuperAdmin;
