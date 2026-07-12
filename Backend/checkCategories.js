const mongoose = require("mongoose");
const Store = require("./src/models/Store");
const Category = require("./src/models/Category");

require("dotenv").config();

async function checkCategories() {
  await mongoose.connect(process.env.MONGODB_URI);
  const categories = await Category.find({});
  console.log(categories);
  process.exit(0);
}

checkCategories();
