const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/multistore?retryWrites=false').then(async () => {
  const { getOrCreateCart, buildCartSummary } = require('./src/lib/cartUtils');
  const cart = await getOrCreateCart("6a53bc60b5f5c14b5f02509c");
  const summary = await buildCartSummary(cart);
  console.log(JSON.stringify(summary.byStore[0].items, null, 2));
  process.exit();
});
