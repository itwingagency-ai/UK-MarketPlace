require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multistore').then(async () => {
  const Store = require('./src/models/Store');
  await Store.updateOne({ slug: 'test-store' }, { $set: { 'location.coordinates': [-0.1278, 51.5074] } });
  console.log('Store coordinates updated to London!');
  mongoose.disconnect();
});
