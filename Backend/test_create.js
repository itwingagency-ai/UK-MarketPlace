require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const { createProduct } = require('./src/controllers/vendorProducts.controller');
const env = require('./src/config/env');

mongoose.connect(env.mongoUri).then(async () => {
  const req = {
    body: {
      title: "Test Product",
      price: 10,
      stock: 5,
      images: []
    },
    user: { role: 'vendor', storeId: new mongoose.Types.ObjectId() },
    storeScopeId: new mongoose.Types.ObjectId()
  };
  
  const res = {
    status: (code) => ({
      json: (data) => console.log(code, data)
    })
  };
  
  const next = (err) => console.log("NEXT CALLED WITH:", err);
  
  try {
    await createProduct(req, res, next);
  } catch (err) {
    console.log("CAUGHT:", err);
  }
  process.exit(0);
});
