require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const dumpDir = path.join(__dirname, "dump");
const modelsDir = path.join(__dirname, "src", "models");

// take_dump.js writes plain JSON, so ObjectIds arrive as 24-char hex strings and
// Dates as ISO strings. Field names alone can't tell them apart from ordinary
// strings (`store`, `user`, `product` are refs; `providerRef` is not), so ask the
// Mongoose schemas which paths are actually ObjectIds and convert only those.
// Without this every populate()/ref lookup in the app silently misses.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const loadModels = () => {
  for (const file of fs.readdirSync(modelsDir).filter((f) => f.endsWith(".js"))) {
    require(path.join(modelsDir, file));
  }

  const byCollection = new Map();
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    byCollection.set(model.collection.collectionName, model);
  }
  return byCollection;
};

// Collect dotted paths that hold ObjectIds, descending into sub-schemas.
const objectIdPaths = (schema, prefix = "", seen = new Set()) => {
  schema.eachPath((pathName, type) => {
    const full = prefix ? `${prefix}.${pathName}` : pathName;

    if (type.instance === "ObjectId") {
      seen.add(full);
    } else if (type.instance === "Array" && type.caster?.instance === "ObjectId") {
      seen.add(full);
    }

    // DocumentArray (schema on the type) and single nested subdocuments.
    const child = type.schema || type.caster?.schema;
    if (child) {
      objectIdPaths(child, full, seen);
    }
  });
  return seen;
};

const toObjectId = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value;

// Apply `fn` at a dotted path, mapping across arrays encountered along the way.
const applyAtPath = (node, segments, fn) => {
  if (node === null || node === undefined) return node;

  if (Array.isArray(node)) {
    return node.map((item) => applyAtPath(item, segments, fn));
  }

  if (!segments.length) {
    return Array.isArray(node) ? node.map(fn) : fn(node);
  }

  if (typeof node !== "object") return node;

  const [head, ...rest] = segments;
  if (!(head in node)) return node;

  const next = node[head];
  node[head] =
    rest.length === 0 && Array.isArray(next)
      ? next.map(fn)
      : applyAtPath(next, rest, fn);
  return node;
};

// Dates are unambiguous by shape, so a plain recursive walk is enough for them.
const reviveDates = (value) => {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) value[k] = reviveDates(v);
    return value;
  }
  if (typeof value === "string" && ISO_DATE.test(value)) return new Date(value);
  return value;
};

const restore = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore";
  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const models = loadModels();
  const db = mongoose.connection.db;
  const files = fs.readdirSync(dumpDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const collectionName = path.basename(file, ".json");
    const docs = JSON.parse(fs.readFileSync(path.join(dumpDir, file), "utf8"));

    await db.collection(collectionName).deleteMany({});

    if (!docs.length) {
      console.log(`${collectionName}: empty, skipped`);
      continue;
    }

    const model = models.get(collectionName);
    if (!model) {
      console.warn(`${collectionName}: no matching model — inserting as-is`);
    }

    const paths = model ? objectIdPaths(model.schema) : new Set(["_id"]);
    const revived = docs.map((doc) => {
      const out = reviveDates(doc);
      for (const p of paths) {
        applyAtPath(out, p.split("."), toObjectId);
      }
      return out;
    });

    await db.collection(collectionName).insertMany(revived);
    console.log(
      `${collectionName}: restored ${revived.length} documents (${paths.size} id paths)`
    );
  }

  console.log("Restore complete.");
  await mongoose.disconnect();
};

restore().catch(async (error) => {
  console.error("Restore failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
