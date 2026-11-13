const Category = require("../models/Category");

/**
 * Helpers for walking a store's category hierarchy.
 *
 * Categories form a tree via `parent`. Stores hold tens of categories, not
 * thousands, so we load a store's whole tree in one lean query and walk it in
 * memory instead of issuing a query per level.
 */

const loadStoreCategories = (storeIds) =>
  Category.find({ store: { $in: storeIds } })
    .select("_id parent isActive store")
    .lean();

const buildChildMap = (categories) => {
  const children = new Map();
  for (const cat of categories) {
    if (!cat.parent) continue;
    const key = String(cat.parent);
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(cat);
  }
  return children;
};

// Breadth-first walk; `visited` guards against a corrupted cycle.
const collectSubtree = (rootIds, childMap, { activeOnly = false } = {}) => {
  const result = new Set();
  const queue = rootIds.map(String);
  while (queue.length > 0) {
    const id = queue.shift();
    if (result.has(id)) continue;
    result.add(id);
    for (const child of childMap.get(id) || []) {
      if (activeOnly && !child.isActive) continue;
      queue.push(String(child._id));
    }
  }
  return result;
};

/**
 * Ids of a category plus all of its descendants. With `activeOnly`, inactive
 * descendants (and everything under them) are skipped.
 */
const getDescendantIds = async (storeId, rootId, options = {}) => {
  const categories = await loadStoreCategories([storeId]);
  return Array.from(collectSubtree([rootId], buildChildMap(categories), options));
};

/**
 * Ids of categories hidden from the storefront: inactive categories and
 * everything beneath them (a hidden parent hides its whole branch).
 * Pass a storeId to scope the lookup, or null for every store.
 */
const getHiddenCategoryIds = async (storeId = null) => {
  const inactiveFilter = { isActive: false };
  if (storeId) inactiveFilter.store = storeId;
  const inactive = await Category.find(inactiveFilter).select("_id store").lean();
  if (inactive.length === 0) return [];

  const storeIds = [...new Set(inactive.map((c) => String(c.store)))];
  const categories = await loadStoreCategories(storeIds);
  return Array.from(
    collectSubtree(inactive.map((c) => c._id), buildChildMap(categories))
  );
};

// Categories created before `sortOrder` existed have no value; a Mongo sort
// would put them ahead of every 0, so sort in memory treating missing as 0.
const compareCategories = (a, b) =>
  (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name));

module.exports = {
  compareCategories,
  buildChildMap,
  collectSubtree,
  getDescendantIds,
  getHiddenCategoryIds,
};
