import client from './client';

export const getProductById = async (idOrSlug) => {
  const { data } = await client.get(`/products/${idOrSlug}`);
  return data;
};

/* ── "Notify me when back in stock" ─────────────────────────────────── */
export const getStockAlerts = async (productId) => {
  const { data } = await client.get('/customer/stock-alerts', { params: { productId } });
  return data;
};
export const createStockAlert = async (productId, variantId) => {
  const { data } = await client.post('/customer/stock-alerts', { productId, variantId: variantId || undefined });
  return data;
};
export const deleteStockAlert = async (productId, variantId) => {
  const { data } = await client.delete('/customer/stock-alerts', { data: { productId, variantId: variantId || undefined } });
  return data;
};
