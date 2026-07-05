require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const dumpDir = path.join(__dirname, "dump");

const takeDump = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore";
    console.log(`Connecting to ${uri}...`);
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    if (!fs.existsSync(dumpDir)) {
      fs.mkdirSync(dumpDir);
    }

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`Found ${collections.length} collections. Starting dump...`);

    for (const coll of collections) {
      const collectionName = coll.name;
      console.log(`Dumping collection: ${collectionName}...`);
      
      const docs = await db.collection(collectionName).find({}).toArray();
      const filePath = path.join(dumpDir, `${collectionName}.json`);
      
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), "utf8");
      console.log(`Saved ${docs.length} documents to ${filePath}`);
    }

    console.log("Database dump completed successfully! Dump files are located in the 'Backend/dump' directory.");
  } catch (error) {
    console.error("Error during dump:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

takeDump();
