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
