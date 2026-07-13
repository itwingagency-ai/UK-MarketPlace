const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/multistore?retryWrites=false').then(async () => {
  const Product = require('./src/models/Product');
  const Cart = require('./src/models/Cart');
  const products = await Product.find({ compareAtPrice: { $gt: 0 } }).lean();
  console.log(products.length + ' products have compareAtPrice');
  const carts = await Cart.find({}).lean();
  console.log(JSON.stringify(carts, null, 2));
  process.exit();
});
