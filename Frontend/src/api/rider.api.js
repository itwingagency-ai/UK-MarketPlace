import client from './client';

/** GET /api/v1/rider/orders?scope=active|done */
export const getMyDeliveries = async (scope = 'active') => {
  const { data } = await client.get('/rider/orders', { params: { scope } });
  return data.data ?? data;
};

export const getDelivery = async (id) => {
  const { data } = await client.get(`/rider/orders/${id}`);
  return data.data ?? data;
};

export const pickUp = async (id) => {
  const { data } = await client.post(`/rider/orders/${id}/pickup`);
  return data;
};

/**
 * POST /api/v1/rider/orders/:id/deliver (multipart)
 * { photoUri?, recipientName?, ageVerified?, idType?, refuseRestricted? }
 */
export const deliver = async (id, { photoUri, recipientName, ageVerified, idType, refuseRestricted }) => {
  const form = new FormData();
  if (photoUri) form.append('photo', { uri: photoUri, name: `proof-${id}.jpg`, type: 'image/jpeg' });
  if (recipientName) form.append('recipientName', recipientName);
  if (ageVerified) form.append('ageVerified', 'true');
  if (idType) form.append('idType', idType);
  if (refuseRestricted) form.append('refuseRestricted', 'true');
  const { data } = await client.post(`/rider/orders/${id}/deliver`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
