require('dotenv').config();
const mongoose = require('mongoose');

const seedMeow = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multistore');
    console.log('Connected to MongoDB');

    const Store = require('./src/models/Store');
    const User = require('./src/models/User');

    // 1. Remove the old store at ZE2 9AA
    const deleteResult = await Store.deleteOne({ 'address.postalCode': 'ZE2 9AA' });
    console.log('Deleted old store:', deleteResult.deletedCount);

    // 2. Create the meow user
    let meowUser = await User.findOne({ email: 'meow@store.com' });
    if (!meowUser) {
      meowUser = await User.create({
        name: 'Meow Owner',
        email: 'meow@store.com',
        password: 'password123',
        role: 'vendor',
        status: 'active'
      });
      console.log('Created meow user');
    }

    // 3. Delete any old meow 123 store to avoid slug conflict
    await Store.deleteOne({ slug: 'meow-123' });

    // 4. Create the new store
    const meowStore = await Store.create({
      name: 'meow 123',
      slug: 'meow-123',
      owner: meowUser._id,
      status: 'active',
      address: {
        postalCode: 'ZE2 9AA',
        city: 'Shetland',
        country: 'UK'
      },
      locationSet: true,
      deliveryRadiusKm: 20,
      location: {
        type: 'Point',
        coordinates: [-1.0224606, 60.3400106]
      }
    });

    console.log('Created new store:', meowStore.name, 'with slug:', meowStore.slug);

  } catch (error) {
    console.error('Error seeding meow store:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

seedMeow();
