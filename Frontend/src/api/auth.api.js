import client from './client';

export const login = async (email, password) => {
  const { data } = await client.post('/auth/login', { email, password });
  return data;
};

export const register = async (name, email, password) => {
  const { data } = await client.post('/auth/register', { name, email, password });
  return data;
};

export const verifySignup = async (email, otp) => {
  const { data } = await client.post('/auth/verify-signup', { email, otp });
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await client.post('/auth/forgot-password', { email });
  return data;
};

export const resetPassword = async (email, otp, newPassword) => {
  const { data } = await client.post('/auth/reset-password', { email, otp, newPassword });
  return data;
};

export const googleLogin = async (idToken) => {
  const { data } = await client.post('/auth/google', { idToken });
  return data;
};

export const logout = async (refreshToken) => {
  const { data } = await client.post('/auth/logout', { refreshToken });
  return data;
};

export const refreshTokens = async (refreshToken) => {
  const { data } = await client.post('/auth/refresh', { refreshToken });
  return data;
};
