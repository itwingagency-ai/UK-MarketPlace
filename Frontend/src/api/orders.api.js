import client from './client';

export const getMyOrders = async () => {
  const response = await client.get('/customer/orders');
  return response.data;
};

export const getMyOrderById = async (id) => {
  const response = await client.get(`/customer/orders/${id}`);
  return response.data;
};
