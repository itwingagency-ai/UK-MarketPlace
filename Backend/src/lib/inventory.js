/**
 * Stock-level rules shared by the vendor dashboard and the public storefront.
 *
 * A product without variants is judged on its own `stock`. A product with
 * variants is only sellable through an active variant that has stock, so its
 * top-level `stock` is ignored.
 */

const LOW_STOCK_THRESHOLD = 5;

const NO_VARIANTS = { "variants.0": { $exists: false } };
const HAS_VARIANTS = { "variants.0": { $exists: true } };

const outOfStockClause = () => ({
  $or: [
    { ...NO_VARIANTS, stock: { $lte: 0 } },
    {
      ...HAS_VARIANTS,
      variants: { $not: { $elemMatch: { isActive: true, stock: { $gt: 0 } } } },
    },
  ],
});

const inStockClause = () => ({ $nor: [outOfStockClause()] });

// Low = still sellable, but the product (or one of its active variants) is at
// or under the threshold. Out-of-stock products are reported separately.
const lowStockClause = (threshold = LOW_STOCK_THRESHOLD) => ({
  $and: [
    {
      $or: [
        { ...NO_VARIANTS, stock: { $gt: 0, $lte: threshold } },
        { variants: { $elemMatch: { isActive: true, stock: { $lte: threshold } } } },
      ],
    },
    inStockClause(),
  ],
});

/**
 * Map a `?stock=` query value to a Mongo clause, or null for no filter.
 */
const stockLevelClause = (level) => {
  if (level === "out") return outOfStockClause();
  if (level === "low") return lowStockClause();
  if (level === "in") return inStockClause();
  return null;
};

module.exports = {
  LOW_STOCK_THRESHOLD,
  inStockClause,
  lowStockClause,
  outOfStockClause,
  stockLevelClause,
};
