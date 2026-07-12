const mongoose = require("mongoose");
const Store = require("./src/models/Store");
const Product = require("./src/models/Product");
const Category = require("./src/models/Category");

require("dotenv").config();

async function checkProducts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find({}).populate("category", "name slug image").lean();
  console.log(JSON.stringify(products, null, 2));
  process.exit(0);
}

checkProducts();
