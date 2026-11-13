/**
 * Turn the flat category list from the API into display order: each parent
 * followed by its subcategories, siblings by sortOrder then name.
 * Every entry gains `depth` (0 = main category) and `path` ("Cakes › Cupcakes").
 */
export function flattenCategoryTree(categories = []) {
  const byParent = new Map();
  const ids = new Set(categories.map((c) => String(c._id)));
  for (const cat of categories) {
    // Treat a parent we can't see as the root so nothing gets lost
    const key = cat.parent && ids.has(String(cat.parent)) ? String(cat.parent) : 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(cat);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
  }

  const result = [];
  const visit = (key, depth, trail) => {
    for (const cat of byParent.get(key) || []) {
      const path = [...trail, cat.name];
      result.push({ ...cat, depth, path: path.join(' › ') });
      if (depth < 20) visit(String(cat._id), depth + 1, path);
    }
  };
  visit('root', 0, []);
  return result;
}

/** Ids of a category and everything beneath it. */
export function descendantIds(categories, rootId) {
  const ids = new Set([String(rootId)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const cat of categories) {
      if (cat.parent && ids.has(String(cat.parent)) && !ids.has(String(cat._id))) {
        ids.add(String(cat._id));
        grew = true;
      }
    }
  }
  return ids;
}

/** Select options showing each category's full path. */
export function categoryOptions(categories) {
  return flattenCategoryTree(categories).map((c) => ({
    value: c._id,
    label: `${c.path}${c.isActive === false ? ' (hidden)' : ''}`,
  }));
}
