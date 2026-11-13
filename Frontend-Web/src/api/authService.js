import client from './client';

const authService = {
  login: (email, password) => client.post('/auth/login', { email, password }),

  logout: (refreshToken) => client.post('/auth/logout', { refreshToken }),

  refresh: (refreshToken) => client.post('/auth/refresh', { refreshToken }),

  register: (name, email, password) =>
    client.post('/auth/register', { name, email, password }),

  verifySignup: (email, otp) => client.post('/auth/verify-signup', { email, otp }),

  resendSignupOtp: (email) => client.post('/auth/resend-signup-otp', { email }),
};

export default authService;
