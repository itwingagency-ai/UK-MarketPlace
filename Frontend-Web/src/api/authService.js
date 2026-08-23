import client from './client';

const authService = {
  login: (email, password) => client.post('/auth/login', { email, password }),

  logout: (refreshToken) => client.post('/auth/logout', { refreshToken }),

  refresh: (refreshToken) => client.post('/auth/refresh', { refreshToken }),

  register: (name, email, password, isVendor = false) =>
    client.post('/auth/register', { name, email, password, isVendor }),
};

export default authService;
