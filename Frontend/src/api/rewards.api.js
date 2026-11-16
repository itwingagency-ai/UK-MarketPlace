import client from './client';

/**
 * GET /api/v1/me/rewards — balance, history page, invite code.
 */
export const getMyRewards = async (page = 1) => {
  const { data } = await client.get('/me/rewards', { params: { page, limit: 20 } });
  return data.data ?? data;
};

/**
 * PUT /api/v1/cart/loyalty — points to spend on this basket (0 = none).
 * The server caps it and returns the cart.
 */
export const setLoyaltyPoints = async (points) => {
  const { data } = await client.put('/cart/loyalty', { points });
  return data;
};
