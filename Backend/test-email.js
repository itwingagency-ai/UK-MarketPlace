require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const User = require("./src/models/User");
const { notify } = require("./src/lib/notificationDispatcher");

async function testEmail() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGODB_URI);
    
    let user = await User.findOne({ email: "abdulkiworld@gmail.com" });
    if (!user) {
      user = await User.create({
        name: "Test Customer",
        email: "abdulkiworld@gmail.com",
        password: "Password123!",
        role: "customer",
        status: "active"
      });
      console.log("Created new user:", user.email);
    } else {
      console.log("User already exists:", user.email);
    }
    
    console.log("Triggering account welcome email via Notification Dispatcher...");
    const result = await notify({
      user,
      eventType: "account.welcome",
      context: {
        name: user.name || "",
        email: user.email || "",
        loginUrl: "http://localhost:3000/login",
      },
    });
    
    console.log("Email dispatch complete! Result:", result ? "Logged in DB" : "Failed");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

testEmail();
