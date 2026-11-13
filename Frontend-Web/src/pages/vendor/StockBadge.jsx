import { StatusBadge } from '../../components/common';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';

/**
 * Stock level for a product (sum of active variants when it has them) or a
 * single variant. Zero always reads "Out of stock".
 */
export function stockLevel(product) {
  const variants = product.variants || [];
  if (variants.length === 0) {
    const stock = Number(product.stock) || 0;
    return { stock, out: stock <= 0, low: stock > 0 && stock <= LOW_STOCK_THRESHOLD };
  }
  const active = variants.filter((v) => v.isActive !== false);
  const stock = active.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const out = !active.some((v) => Number(v.stock) > 0);
  const low = !out && active.some((v) => Number(v.stock) <= LOW_STOCK_THRESHOLD);
  return { stock, out, low };
}

export default function StockBadge({ stock, out, low }) {
  if (out) return <StatusBadge status="cancelled" label="Out of stock" size="sm" />;
  if (low) return <StatusBadge status="pending" label="Low stock" size="sm" />;
  return <StatusBadge status="active" label="In stock" size="sm" />;
}
