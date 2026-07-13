import client from './client';

/**
 * Preview checkout to get subtotal, shipping fee, and total.
 */
export const previewCheckout = async (params = {}) => {
  const { data } = await client.get('/checkout/preview', { params });
  return data;
};

/**
 * Place an order.
 * Payload should include:
 * - shippingAddress or addressId
 * - paymentMethod ("online" or "cod")
 * - clientType: "mobile" (for Stripe PaymentIntent)
 * - notes (optional)
 */
export const placeOrder = async (payload) => {
  const { data } = await client.post('/checkout', payload);
  return data;
};

export const cancelTransaction = async (transactionId) => {
  const { data } = await client.post(`/payments/transactions/${transactionId}/cancel`);
  return data;
};

export const confirmTransaction = async (transactionId) => {
  const { data } = await client.post(`/payments/transactions/${transactionId}/confirm`);
  return data;
};
