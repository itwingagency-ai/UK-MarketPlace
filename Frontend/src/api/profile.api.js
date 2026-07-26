import client from './client';

export const updateProfile = async (data) => {
  const response = await client.patch('/customer/me', data);
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await client.patch('/customer/me/password', {
    currentPassword,
    newPassword,
  });
  return response.data;
};

export const getMyAddresses = async () => {
  const response = await client.get('/customer/me/addresses');
  return response.data;
};

export const addMyAddress = async (data) => {
  const response = await client.post('/customer/me/addresses', data);
  return response.data;
};

export const updateMyAddress = async (id, data) => {
  const response = await client.patch(`/customer/me/addresses/${id}`, data);
  return response.data;
};

export const deleteMyAddress = async (id) => {
  const response = await client.delete(`/customer/me/addresses/${id}`);
  return response.data;
};
