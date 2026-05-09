const mongoose = require("mongoose");
const env = require("./env");

const connectDb = async () => {
  await mongoose.connect(env.mongodbUri);
  // eslint-disable-next-line no-console
  console.log("MongoDB connected");
};

module.exports = connectDb;
