import axios from 'axios';
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
 * Decode a UK postcode to a human-readable location name.
 * Uses the free postcodes.io API (no key required).
 * Returns { admin_ward, admin_district, region, country } or null on failure.
 *
 * @param {string} postcode - e.g. "DD1 3JA"
 */
export const decodePostcode = async (postcode) => {
  try {
    const encoded = encodeURIComponent(postcode.trim().toUpperCase());
    const { data } = await axios.get(`https://api.postcodes.io/postcodes/${encoded}`, {
      timeout: 5000,
    });
    if (data.status === 200 && data.result) {
      return {
        admin_ward: data.result.admin_ward,
        admin_district: data.result.admin_district,
        region: data.result.region,
        country: data.result.country,
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
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
