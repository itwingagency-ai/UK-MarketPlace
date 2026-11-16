import client from './client';

/** GET /api/v1/app/config — version gate + feature switches (public). */
export const getAppConfig = async (platform, version) => {
  const { data } = await client.get('/app/config', { params: { platform, version } });
  return data.data ?? data;
};

/** GET /api/v1/banners — live home banners for where the customer is. */
export const getBanners = async ({ lat, lng } = {}) => {
  const params = lat != null && lng != null ? { lat, lng } : {};
  const { data } = await client.get('/banners', { params });
  return data.data ?? data;
};

/** GET /api/v1/address/lookup — { enabled, addresses } (enabled false = type it in). */
export const lookupAddress = async (postcode) => {
  const { data } = await client.get('/address/lookup', { params: { postcode } });
  return data.data ?? data;
};

export const requestAccountDeletionCode = async () => (await client.post('/me/account/delete-code', {})).data;
export const deleteAccount = async (code) => (await client.post('/me/account/delete', { code })).data;

export const getSavedCards = async () => {
  const { data } = await client.get('/me/payment-methods');
  return data.data ?? data;
};
export const removeSavedCard = async (id) => (await client.delete(`/me/payment-methods/${id}`)).data;
