import client from './client';

/** Repeat orders (subscriptions). Prices are always worked out when each order is placed. */
export const createRepeatOrder = async (body) => (await client.post('/customer/subscriptions', body)).data;
export const getRepeatOrders = async () => {
  const { data } = await client.get('/customer/subscriptions');
  return data.data ?? data;
};
export const updateRepeatOrder = async (id, body) => (await client.patch(`/customer/subscriptions/${id}`, body)).data;

/** SetupIntent so a card can be charged for repeat orders without you present. */
export const setupCardForRepeatOrders = async () => {
  const { data } = await client.post('/me/payment-methods/setup', {});
  return data.data ?? data;
};
