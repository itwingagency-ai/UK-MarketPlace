import client from './client';

/**
 * GET /api/v1/cart
 */
export const getCart = async () => {
  const { data } = await client.get('/cart');
  return data.data ?? data;
};

/**
 * POST /api/v1/cart/items
 * @param {string} productId
 * @param {number} quantity
 */
export const addItem = async (productId, quantity = 1, variantId = null) => {
  const body = { productId, quantity };
  if (variantId) body.variantId = variantId;
  const { data } = await client.post('/cart/items', body);
  return data.data ?? data;
};

/**
 * PATCH /api/v1/cart/items/:itemId
 */
export const updateItemQuantity = async (itemId, quantity) => {
  const { data } = await client.patch(`/cart/items/${itemId}`, { quantity });
  return data.data ?? data;
};

/**
 * DELETE /api/v1/cart/items/:itemId
 */
export const removeItem = async (itemId) => {
  const { data } = await client.delete(`/cart/items/${itemId}`);
  return data.data ?? data;
};

/**
 * DELETE /api/v1/cart
 */
export const clearCart = async () => {
  const { data } = await client.delete('/cart');
  return data.data ?? data;
};

/**
 * POST /api/v1/cart/coupon — the server decides what the code is worth.
 */
export const applyCoupon = async (code) => {
  const { data } = await client.post('/cart/coupon', { code });
  return data;
};

/**
 * DELETE /api/v1/cart/coupon/:code
 */
export const removeCoupon = async (code) => {
  const { data } = await client.delete(`/cart/coupon/${encodeURIComponent(code)}`);
  return data;
};

/**
 * PUT /api/v1/cart/tip — amount in pence, 0 removes the tip.
 */
export const setTip = async (storeId, amount) => {
  const { data } = await client.put('/cart/tip', { storeId, amount });
  return data;
};

/**
 * PUT /api/v1/cart/options
 * { allowSubstitutions?, stores?: [{ storeId, note?, bags? }] }
 */
export const setCartOptions = async (options) => {
  const { data } = await client.put('/cart/options', options);
  return data;
};

/**
 * PUT /api/v1/cart/fulfilment — delivery or collection for one store,
 * slotStart null = as soon as possible.
 */
export const setFulfilment = async (storeId, method, slotStart = null) => {
  const { data } = await client.put('/cart/fulfilment', { storeId, method, slotStart });
  return data;
};
