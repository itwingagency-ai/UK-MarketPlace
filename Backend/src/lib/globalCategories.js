const Category = require("../models/Category");
const GlobalCategory = require("../models/GlobalCategory");
const Product = require("../models/Product");
const { getHiddenCategoryIds } = require("./categoryTree");

/**
 * The marketplace taxonomy a fresh install starts with — one per 3D icon.
 * seed-global-categories.js inserts any that are missing (matched by slug)
 * and never overwrites what the admin has edited since.
 */
const DEFAULT_GLOBAL_CATEGORIES = [
  ["Fruit & Veg", "fruit-veg", "cat-fruit-veg", "groceriesMint", true, ["fruit", "veg", "vegetables", "produce", "salad", "greengrocer"]],
  ["Bakery", "bakery", "cat-bakery", "bakeryAmber", true, ["bread", "cakes", "cupcakes", "pastries", "baker", "sweets & bakery"]],
  ["Dairy & Eggs", "dairy-eggs", "cat-dairy-eggs", "dairySky", true, ["milk", "cheese", "eggs", "butter", "yoghurt", "dairy"]],
  ["Meat & Fish", "meat-fish", "cat-meat-fish", "meatCoral", true, ["meat", "fish", "butcher", "chicken", "seafood", "poultry"]],
  ["Drinks", "drinks", "cat-drinks", "drinksViolet", true, ["soft drinks", "juice", "water", "fizzy", "beverages"]],
  ["Snacks & Sweets", "snacks-sweets", "cat-snacks-sweets", "bakeryAmber", true, ["snacks", "sweets", "crisps", "chocolate", "confectionery"]],
  ["Household", "household", "cat-household", "householdIndigo", true, ["cleaning", "laundry", "toilet roll", "kitchen roll", "home"]],
  ["Frozen", "frozen", "cat-frozen", "frozenCyan", true, ["ice cream", "frozen food", "freezer"]],
  ["Pharmacy", "pharmacy", "cat-pharmacy", "pharmacyTeal", true, ["medicine", "chemist", "painkillers", "first aid"]],
  ["Tea & Coffee", "tea-coffee", "cat-tea-coffee", "bakeryAmber", false, ["tea", "coffee", "hot drinks"]],
  ["Tinned & Cupboard", "tinned-cupboard", "cat-tinned-cupboard", "groceriesMint", false, ["tins", "cupboard", "pasta", "rice", "cereal", "store cupboard", "pantry"]],
  ["Breakfast", "breakfast", "cat-breakfast", "bakeryAmber", false, ["cereal", "porridge", "jam", "spreads"]],
  ["Ready Meals", "ready-meals", "cat-ready-meals", "meatCoral", false, ["ready meals", "fast food", "takeaway", "hot food", "sandwiches", "meal deal"]],
  ["World Foods", "world-foods", "cat-world-foods", "meatCoral", false, ["world food", "international", "asian", "polish", "caribbean", "african"]],
  ["Halal", "halal", "cat-halal", "groceriesMint", false, ["halal"]],
  ["Vegan", "vegan", "cat-vegan", "groceriesMint", false, ["vegan", "plant based", "vegetarian"]],
  ["Alcohol", "alcohol", "cat-alcohol", "drinksViolet", false, ["beer", "wine", "spirits", "cider"]],
  ["Off Licence", "off-licence", "cat-off-licence", "drinksViolet", false, ["off licence", "offie", "tobacco"]],
  ["Baby", "baby", "cat-baby", "dairySky", false, ["baby", "nappies", "formula", "wipes"]],
  ["Health & Beauty", "health-beauty", "cat-health-beauty", "pharmacyTeal", false, ["toiletries", "beauty", "skincare", "shampoo", "toothpaste"]],
  ["Pet", "pet", "cat-pet", "householdIndigo", false, ["pet food", "dog", "cat", "pets"]],
  ["Flowers", "flowers", "cat-flowers", "groceriesMint", false, ["flowers", "bouquet", "plants", "florist"]],
  ["Stationery", "stationery", "cat-stationery", "householdIndigo", false, ["stationery", "pens", "cards", "paper"]],
  ["Electronics", "electronics", "cat-electronics", "householdIndigo", false, ["electronics", "chargers", "batteries", "phone accessories"]],
].map(([name, slug, assetKey, accentColor, isFeatured, keywords], index) => ({
  name,
  slug,
  icon3d: { assetKey },
  accentColor,
  isFeatured,
  keywords,
  sortOrder: index,
}));

/**
 * A global category plus its active sub-categories (the tree is two levels).
 * Returns [] when the slug or id matches nothing active.
 */
const resolveGlobalBranch = async (slugOrId) => {
  const query = /^[a-f\d]{24}$/i.test(slugOrId)
    ? { _id: slugOrId, isActive: true }
    : { slug: String(slugOrId).toLowerCase(), isActive: true };
  const root = await GlobalCategory.findOne(query).select("_id").lean();
  if (!root) return [];
  const children = await GlobalCategory.find({ parent: root._id, isActive: true })
    .select("_id")
    .lean();
  return [root._id, ...children.map((c) => c._id)];
};

/**
 * Ids of stores that sell something under a global category branch: an
 * active store category (with no hidden ancestor) mapped to the branch that
 * holds at least one active product.
 */
const findStoreIdsSellingGlobal = async (globalIds) => {
  if (globalIds.length === 0) return new Set();
  const [mapped, hiddenIds] = await Promise.all([
    Category.find({ globalCategory: { $in: globalIds }, isActive: true }).select("_id").lean(),
    getHiddenCategoryIds(null),
  ]);
  const hidden = new Set(hiddenIds.map(String));
  const categoryIds = mapped.map((c) => c._id).filter((id) => !hidden.has(String(id)));
  if (categoryIds.length === 0) return new Set();

  const storeIds = await Product.distinct("store", {
    category: { $in: categoryIds },
    isActive: true,
  });
  return new Set(storeIds.map(String));
};

/**
 * Public shape of a global category, shared by the admin and public APIs.
 */
const formatGlobalCategory = (cat) => ({
  id: cat._id,
  name: cat.name,
  slug: cat.slug,
  parent: cat.parent || null,
  description: cat.description || "",
  icon3d: { assetKey: cat.icon3d?.assetKey || "" },
  accentColor: cat.accentColor,
  sortOrder: cat.sortOrder || 0,
  isActive: cat.isActive,
  isFeatured: cat.isFeatured,
  keywords: cat.keywords || [],
  seo: { title: cat.seo?.title || "", description: cat.seo?.description || "" },
});

// Roots in sortOrder, each followed by its children in sortOrder
const orderAsTree = (categories) => {
  const bySort = (a, b) =>
    (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name));
  const roots = categories.filter((c) => !c.parent).sort(bySort);
  const ordered = [];
  for (const root of roots) {
    ordered.push(root);
    ordered.push(
      ...categories.filter((c) => c.parent && String(c.parent) === String(root._id)).sort(bySort)
    );
  }
  // Orphans (parent deleted or inactive-filtered) go last rather than vanish
  const placed = new Set(ordered.map((c) => String(c._id)));
  ordered.push(...categories.filter((c) => !placed.has(String(c._id))).sort(bySort));
  return ordered;
};

module.exports = {
  DEFAULT_GLOBAL_CATEGORIES,
  findStoreIdsSellingGlobal,
  formatGlobalCategory,
  orderAsTree,
  resolveGlobalBranch,
};
