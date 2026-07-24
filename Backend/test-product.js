const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/multistore?retryWrites=false').then(async () => {
  const Product = require('./src/models/Product');
  const p1 = await Product.findById("6a52e852b87d1cfd125b70e8").lean();
  const p2 = await Product.findById("6a52e852b87d1cfd125b70e9").lean();
  console.log(p1.title, p1.price, p1.compareAtPrice);
  console.log(p2.title, p2.price, p2.compareAtPrice);
  process.exit();
});
