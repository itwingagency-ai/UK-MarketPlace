/**
 * Form helpers for the shopkeeper screens. Business rules (validation,
 * pricing of variant products, stock safety) live on the server; these only
 * translate between what a shopkeeper types and what the API expects.
 * Mirrors Frontend-Web's ProductVariantEditor / categoryTree helpers.
 */

// Matches LOW_STOCK_THRESHOLD in Backend/src/lib/inventory.js
export const LOW_STOCK_THRESHOLD = 5;
export const MAX_PRODUCT_IMAGES = 10;
export const MAX_IMAGES_PER_UPLOAD = 5;

/* ── Prices ─────────────────────────────────────────────────────────────
 * Stored in pence as `price` (what the customer pays) and `compareAtPrice`
 * (the crossed-out original). Shopkeepers think "regular" + optional "sale". */
const toPounds = (pence) => (pence === null || pence === undefined ? '' : (Number(pence) / 100).toFixed(2));
const toPence = (pounds) => Math.round(Number(String(pounds).replace(',', '.')) * 100);

export function toPriceFields(price, compareAtPrice) {
  if (compareAtPrice && Number(compareAtPrice) > Number(price)) {
    return { regularPrice: toPounds(compareAtPrice), salePrice: toPounds(price) };
  }
  return { regularPrice: toPounds(price), salePrice: '' };
}

/** Returns { price, compareAtPrice } in pence, or { error }. */
export function fromPriceFields(regularPrice, salePrice, label = 'Price') {
  const regular = toPence(regularPrice);
  if (regularPrice === '' || regularPrice === undefined || Number.isNaN(regular) || regular < 0) {
    return { error: `${label}: enter a regular price` };
  }
  if (salePrice === '' || salePrice === undefined || salePrice === null) {
    return { price: regular, compareAtPrice: null };
  }
  const sale = toPence(salePrice);
  if (Number.isNaN(sale) || sale < 0) return { error: `${label}: sale price is not a valid amount` };
  if (sale >= regular) return { error: `${label}: sale price must be lower than the regular price` };
  return { price: sale, compareAtPrice: regular };
}

/* ── Variants (sizes / options) ──────────────────────────────────────── */
export const emptyVariantRow = () => ({ value: '', regularPrice: '', salePrice: '', stock: '0', isActive: true });

export function variantStateFromProduct(product) {
  const variants = product?.variants || [];
  if (variants.length === 0) return { enabled: false, optionName: 'Size', rows: [] };

  const optionName = product.options?.[0]?.name || Object.keys(variants[0].attributes || {})[0] || 'Size';
  const rows = variants.map((v) => {
    const attrs = v.attributes || {};
    const keys = Object.keys(attrs);
    const value = keys.length > 1 ? Object.values(attrs).join(' / ') : attrs[optionName] ?? Object.values(attrs)[0] ?? '';
    return {
      _id: v._id,
      value: String(value),
      ...toPriceFields(v.price, v.compareAtPrice),
      stock: String(v.stock ?? 0),
      originalStock: String(v.stock ?? 0),
      isActive: v.isActive !== false,
    };
  });
  return { enabled: true, optionName, rows };
}

/** Build the API's `options` + `variants` payload, or { error }. */
export function variantPayload({ optionName, rows }) {
  const name = (optionName || '').trim();
  if (!name) return { error: 'Give your options a name, e.g. Size or Weight' };
  if (/[.$]/.test(name)) return { error: 'Option name cannot contain "." or "$"' };
  if (rows.length === 0) return { error: 'Add at least one size, or switch sizes off' };

  const seen = new Set();
  const variants = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const value = row.value.trim();
    const label = value || `Option ${i + 1}`;
    if (!value) return { error: `${label}: enter a name, e.g. Small or 500 g` };
    if (seen.has(value.toLowerCase())) return { error: `"${value}" is listed twice` };
    seen.add(value.toLowerCase());

    const prices = fromPriceFields(row.regularPrice, row.salePrice, label);
    if (prices.error) return prices;
    const stock = Number(row.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: `${label}: stock must be a whole number, 0 or more` };

    const variant = {
      attributes: { [name]: value },
      price: prices.price,
      compareAtPrice: prices.compareAtPrice,
      isActive: row.isActive,
    };
    if (row._id) variant._id = row._id;
    // Leave untouched stock out so the server keeps its live value — a sale
    // made while this form was open must not be undone.
    if (!row._id || String(row.stock) !== String(row.originalStock)) variant.stock = stock;
    variants.push(variant);
  }
  return { options: [{ name, values: variants.map((v) => v.attributes[name]) }], variants };
}

export const variantLabel = (variant, i = 0) =>
  Object.values(variant?.attributes || {}).join(' / ') || `Option ${i + 1}`;

/* ── Stock ───────────────────────────────────────────────────────────── */
export function stockLevel(product) {
  const variants = product?.variants || [];
  if (variants.length === 0) {
    const stock = Number(product?.stock) || 0;
    return { stock, out: stock <= 0, low: stock > 0 && stock <= LOW_STOCK_THRESHOLD };
  }
  const active = variants.filter((v) => v.isActive !== false);
  const stock = active.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const out = !active.some((v) => Number(v.stock) > 0);
  const low = !out && active.some((v) => Number(v.stock) <= LOW_STOCK_THRESHOLD);
  return { stock, out, low };
}

/* ── Categories ──────────────────────────────────────────────────────── */
/** Display order: each parent followed by its subcategories, with depth + path. */
export function flattenCategoryTree(categories = []) {
  const ids = new Set(categories.map((c) => String(c._id)));
  const byParent = new Map();
  for (const cat of categories) {
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

/* ── Images ──────────────────────────────────────────────────────────── */
/** An expo-image-picker asset as a multipart file part. */
export function imagePart(asset, fallbackName = 'photo') {
  const type = asset.mimeType || 'image/jpeg';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  return { uri: asset.uri, name: asset.fileName || `${fallbackName}.${ext}`, type };
}

export const apiError = (err, fallback) => err?.response?.data?.message || fallback;
