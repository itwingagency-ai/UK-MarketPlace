import client from './client';

/**
 * POST /api/v1/auth/login
 */
export const login = async (email, password) => {
  const { data } = await client.post('/auth/login', { email, password });
  return data; // { message, user, accessToken, refreshToken }
};

/**
 * POST /api/v1/auth/register
 */
export const register = async (name, email, password) => {
  const { data } = await client.post('/auth/register', { name, email, password });
  return data; // { message, user, accessToken, refreshToken }
};

/**
 * POST /api/v1/auth/logout
 */
export const logout = async (refreshToken) => {
  const { data } = await client.post('/auth/logout', { refreshToken });
  return data;
};

/**
 * POST /api/v1/auth/refresh
 */
export const refreshTokens = async (refreshToken) => {
  const { data } = await client.post('/auth/refresh', { refreshToken });
  return data; // { message, accessToken, refreshToken }
};
