require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multistore').then(async () => {
  const Store = require('./src/models/Store');
  await Store.updateOne(
    { 'address.postalCode': 'ZE2 9AA' },
    {
      $set: {
        'location.coordinates': [-1.0224606, 60.3400106],
        deliveryRadiusKm: 20
      }
    }
  );
  console.log('Store coordinates updated to match geocoded ZE2 9AA and radius increased!');
  mongoose.disconnect();
});
