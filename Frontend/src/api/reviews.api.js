import client from './client';

export const getMyReviews = async (params = {}) => {
  const response = await client.get('/customer/reviews', { params });
  return response.data;
};

export const checkReviewEligibility = async (productId) => {
  const response = await client.get(`/customer/products/${productId}/reviews/eligibility`);
  return response.data;
};

export const submitReview = async (productId, data) => {
  const response = await client.post(`/customer/products/${productId}/reviews`, data);
  return response.data;
};

export const updateMyReview = async (id, data) => {
  const response = await client.patch(`/customer/reviews/${id}`, data);
  return response.data;
};

export const deleteMyReview = async (id) => {
  const response = await client.delete(`/customer/reviews/${id}`);
  return response.data;
};

export const getProductReviews = async (productId, params = {}) => {
  const response = await client.get(`/products/${productId}/reviews`, { params });
  return response.data;
};

export const getProductReviewStats = async (productId) => {
  const response = await client.get(`/products/${productId}/reviews/stats`);
  return response.data;
};
