const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/multistore?retryWrites=false').then(async () => {
  const db = mongoose.connection.db;
  await db.collection('carts').updateOne(
    { "items.product": new mongoose.Types.ObjectId("6a52e852b87d1cfd125b70e8") },
    { $set: { "items.$.compareAtPrice": 699 } }
  );
  await db.collection('carts').updateOne(
    { "items.product": new mongoose.Types.ObjectId("6a52e852b87d1cfd125b70e9") },
    { $set: { "items.$.compareAtPrice": 300 } }
  );
  console.log("Updated carts directly in DB!");
  process.exit();
});
