/**
 * Category Studio setup — safe to re-run.
 *
 * 1. Inserts any default marketplace (global) categories that are missing,
 *    matched by slug. Categories the admin has edited are never overwritten.
 * 2. Maps store categories that have no global category yet: by name first,
 *    then by keyword. Sub-categories inherit their parent's mapping.
 *    Anything it can't place is listed so an admin/vendor can map it by hand.
 *
 * Usage: node seed-global-categories.js [--dry-run]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./src/models/Category");
const GlobalCategory = require("./src/models/GlobalCategory");
require("./src/models/Store"); // for populate("store")
const { DEFAULT_GLOBAL_CATEGORIES } = require("./src/lib/globalCategories");

const dryRun = process.argv.includes("--dry-run");

const normalise = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const findMatch = (name, globals) => {
  const target = normalise(name);
  const exact = globals.find((g) => normalise(g.name) === target);
  if (exact) return exact;

  // Longest keyword wins, so "sweets & bakery" beats "sweets"
  let best = null;
  let bestLength = 0;
  for (const g of globals) {
    for (const keyword of [g.name, ...(g.keywords || [])]) {
      const k = normalise(keyword);
      const hit = k && (` ${target} `.includes(` ${k} `) || k === target);
      if (hit && k.length > bestLength) {
        best = g;
        bestLength = k.length;
      }
    }
  }
  return best;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/multistore");

  let inserted = 0;
  for (const def of DEFAULT_GLOBAL_CATEGORIES) {
    if (dryRun) {
      if (!(await GlobalCategory.exists({ slug: def.slug }))) inserted += 1;
      continue;
    }
    const result = await GlobalCategory.updateOne(
      { slug: def.slug },
      { $setOnInsert: def },
      { upsert: true }
    );
    if (result.upsertedCount) inserted += 1;
  }
  console.log(`Global categories: ${inserted} added${dryRun ? " (dry run)" : ""}`);

  const globals = await GlobalCategory.find({ isActive: true }).lean();
  const unmapped = await Category.find({ globalCategory: null })
    .populate("store", "name")
    .lean();

  // Roots first so children can inherit
  unmapped.sort((a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)));
  const mappedNow = new Map();
  const leftOver = [];

  for (const cat of unmapped) {
    let target = findMatch(cat.name, globals);
    let how = "name";
    if (!target && cat.parent) {
      const parentGlobal =
        mappedNow.get(String(cat.parent)) ||
        (await Category.findById(cat.parent).select("globalCategory").lean())?.globalCategory;
      if (parentGlobal) {
        target = globals.find((g) => String(g._id) === String(parentGlobal));
        how = "parent";
      }
    }

    if (!target) {
      leftOver.push(cat);
      continue;
    }
    mappedNow.set(String(cat._id), target._id);
    console.log(`  ${cat.store?.name || cat.store} | ${cat.name} → ${target.name} (${how})`);
    if (!dryRun) {
      await Category.updateOne({ _id: cat._id }, { $set: { globalCategory: target._id } });
    }
  }

  console.log(`Store categories mapped: ${mappedNow.size}${dryRun ? " (dry run)" : ""}`);
  if (leftOver.length) {
    console.log(`Still unmapped (${leftOver.length}) — map these in the vendor portal:`);
    for (const cat of leftOver) console.log(`  ${cat.store?.name || cat.store} | ${cat.name}`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
