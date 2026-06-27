const mongoose = require('mongoose');

const schema = new mongoose.Schema({ title: String });
schema.pre('save', function(arg1, arg2) {
  console.log("arg1 type:", typeof arg1, Array.isArray(arg1));
  console.log("arg2 type:", typeof arg2);
  
  if (typeof arg1 === 'function') arg1();
  else if (typeof arg2 === 'function') arg2();
});

const Model = mongoose.model('Test2', schema);

async function run() {
  const doc = new Model({ title: "Hello" });
  try {
    await doc.save();
    console.log("Saved");
  } catch (err) {
    console.log("Error:", err);
  }
}

run();
