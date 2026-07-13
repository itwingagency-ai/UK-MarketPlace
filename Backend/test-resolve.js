const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/multistore?retryWrites=false').then(async () => {
  const { resolveProductForCart } = require('./src/lib/cartUtils');
  const resolved = await resolveProductForCart({ productId: "6a52e852b87d1cfd125b70e8" });
  console.log(resolved);
  process.exit();
});
