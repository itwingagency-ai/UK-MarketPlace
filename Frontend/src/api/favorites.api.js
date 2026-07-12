import client from './client';

export const getFavorites = async (lat, lng) => {
  const params = {};
  if (lat && lng) {
    params.lat = lat;
    params.lng = lng;
  }
  const { data } = await client.get('/customer/me/favorites', { params });
  return data;
};

export const addFavoriteStore = async (storeId) => {
  const { data } = await client.post(`/customer/me/favorites/stores/${storeId}`);
  return data;
};

export const removeFavoriteStore = async (storeId) => {
  const { data } = await client.delete(`/customer/me/favorites/stores/${storeId}`);
  return data;
};

export const addFavoriteProduct = async (productId) => {
  const { data } = await client.post(`/customer/me/favorites/products/${productId}`);
  return data;
};

export const removeFavoriteProduct = async (productId) => {
  const { data } = await client.delete(`/customer/me/favorites/products/${productId}`);
  return data;
};
