import client from './client';

/**
 * GET /api/v1/stores/nearby
 * @param {string} postcode - e.g. "SW1A 1AA"
 * @param {number} [lat]
 * @param {number} [lng]
 */
export const getNearbyStores = async ({ postcode, lat, lng } = {}) => {
  const params = {};
  if (postcode) params.postcode = postcode;
  if (lat !== undefined) params.lat = lat;
  if (lng !== undefined) params.lng = lng;

  const { data } = await client.get('/stores/nearby', { params });
  return data;
};

/**
 * GET /api/v1/stores/:slug
 */
export const getStoreBySlug = async (slug) => {
  const { data } = await client.get(`/stores/${slug}`);
  return data;
};

/**
 * GET /api/v1/stores/:slug/status
 */
export const getStoreStatus = async (slug) => {
  const { data } = await client.get(`/stores/${slug}/status`);
  return data;
};

/**
 * GET /api/v1/stores/:slug/products
 * @param {string} slug
 * @param {object} params - { page, limit, category, search }
 */
export const getStoreProducts = async (slug, params = {}) => {
  const { data } = await client.get(`/stores/${slug}/products`, { params });
  return data;
};

/**
 * GET /api/v1/stores/:slug/delivers
 */
export const checkDeliverability = async (slug, { address, lat, lng } = {}) => {
  const params = {};
  if (address) params.address = address;
  if (lat !== undefined) params.lat = lat;
  if (lng !== undefined) params.lng = lng;

  const { data } = await client.get(`/stores/${slug}/delivers`, { params });
  return data;
};
