import client from './client';

/**
 * GET /api/v1/cart
 */
export const getCart = async () => {
  const { data } = await client.get('/cart');
  return data;
};

/**
 * POST /api/v1/cart/items
 * @param {string} productId
 * @param {number} quantity
 */
export const addItem = async (productId, quantity = 1) => {
  const { data } = await client.post('/cart/items', { productId, quantity });
  return data;
};

/**
 * PATCH /api/v1/cart/items/:itemId
 */
export const updateItemQuantity = async (itemId, quantity) => {
  const { data } = await client.patch(`/cart/items/${itemId}`, { quantity });
  return data;
};

/**
 * DELETE /api/v1/cart/items/:itemId
 */
export const removeItem = async (itemId) => {
  const { data } = await client.delete(`/cart/items/${itemId}`);
  return data;
};

/**
 * DELETE /api/v1/cart
 */
export const clearCart = async () => {
  const { data } = await client.delete('/cart');
  return data;
};
