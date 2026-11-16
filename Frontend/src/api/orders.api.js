import client from './client';

export const getMyOrders = async () => {
  const response = await client.get('/customer/orders');
  return response.data;
};

export const getMyOrderById = async (id) => {
  const response = await client.get(`/customer/orders/${id}`);
  return response.data;
};

// Put a past order's items back in the basket (capped at what's in stock)
export const reorder = async (id) => {
  const response = await client.post(`/customer/orders/${id}/reorder`);
  return response.data;
};

// Cancel an order the store hasn't accepted yet (card payments are refunded)
export const cancelMyOrder = async (id, reason) => {
  const response = await client.post(`/customer/orders/${id}/cancel`, reason ? { reason } : {});
  return response.data;
};

// Collecting: tell the store you're outside (note e.g. "Blue car, bay 3")
export const markArrived = async (id, note) => {
  const response = await client.post(`/customer/orders/${id}/arrived`, note ? { note } : {});
  return response.data;
};
