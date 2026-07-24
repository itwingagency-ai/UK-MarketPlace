import client from './client';

export const getProductById = async (idOrSlug) => {
  const { data } = await client.get(`/products/${idOrSlug}`);
  return data;
};
