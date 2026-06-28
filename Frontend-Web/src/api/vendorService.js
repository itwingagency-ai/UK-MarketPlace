import client from './client';

export const vendorService = {
  getDashboardOverview: async () => {
    const { data } = await client.get('/vendor/dashboard/overview');
    return data;
  },
  
  getStoreSettings: async () => {
    const { data } = await client.get('/vendor/dashboard/settings');
    return data;
  },
  
  updateStoreSettings: async (payload) => {
    const { data } = await client.patch('/vendor/dashboard/settings', payload);
    return data;
  },
  
  getOperatingHours: async () => {
    const { data } = await client.get('/vendor/dashboard/operating-hours');
    return data;
  },
  
  updateOperatingHours: async (payload) => {
    const { data } = await client.put('/vendor/dashboard/operating-hours', payload);
    return data;
  },
  
  getLocation: async () => {
    const { data } = await client.get('/vendor/dashboard/location');
    return data;
  },
  
  updateLocation: async (payload) => {
    const { data } = await client.patch('/vendor/dashboard/location', payload);
    return data;
  },
  
  getShippingMethods: async () => {
    const { data } = await client.get('/vendor/dashboard/shipping-methods');
    return data;
  },
  
  createShippingMethod: async (payload) => {
    const { data } = await client.post('/vendor/dashboard/shipping-methods', payload);
    return data;
  },
  
  updateShippingMethod: async (id, payload) => {
    const { data } = await client.patch(`/vendor/dashboard/shipping-methods/${id}`, payload);
    return data;
  },
  
  deleteShippingMethod: async (id) => {
    const { data } = await client.delete(`/vendor/dashboard/shipping-methods/${id}`);
    return data;
  },
  
  getAnalyticsOverview: async () => {
    const { data } = await client.get('/vendor/dashboard/analytics/overview');
    return data;
  },

  /* ── Categories ─────────────────────────────────────────────────────── */
  getCategories: async () => {
    const { data } = await client.get('/vendor/dashboard/categories');
    return data;
  },
  createCategory: async (payload) => {
    const { data } = await client.post('/vendor/dashboard/categories', payload);
    return data;
  },
  updateCategory: async (id, payload) => {
    const { data } = await client.patch(`/vendor/dashboard/categories/${id}`, payload);
    return data;
  },
  deleteCategory: async (id) => {
    const { data } = await client.delete(`/vendor/dashboard/categories/${id}`);
    return data;
  },

  /* ── Products ───────────────────────────────────────────────────────── */
  getProducts: async (params) => {
    const { data } = await client.get('/vendor/dashboard/products', { params });
    return data;
  },
  createProduct: async (payload) => {
    const { data } = await client.post('/vendor/dashboard/products', payload);
    return data;
  },
  updateProduct: async (id, payload) => {
    const { data } = await client.patch(`/vendor/dashboard/products/${id}`, payload);
    return data;
  },
  deleteProduct: async (id) => {
    const { data } = await client.delete(`/vendor/dashboard/products/${id}`);
    return data;
  },
  restoreProduct: async (id) => {
    const { data } = await client.patch(`/vendor/dashboard/products/${id}/restore`);
    return data;
  },

  /* ── Orders ──────────────────────────────────────────────────────────── */
  getOrders: async (params) => {
    const { data } = await client.get('/vendor/dashboard/orders', { params });
    return data;
  },
  getOrder: async (id) => {
    const { data } = await client.get(`/vendor/dashboard/orders/${id}`);
    return data;
  },
  getOrderHistory: async (id) => {
    const { data } = await client.get(`/vendor/dashboard/orders/${id}/history`);
    return data;
  },
  updateOrderStatus: async (id, payload) => {
    const { data } = await client.patch(`/vendor/dashboard/orders/${id}/status`, payload);
    return data;
  },
  getShipmentEvents: async (id) => {
    const { data } = await client.get(`/vendor/dashboard/orders/${id}/tracking/events`);
    return data;
  },
  addShipmentEvent: async (id, payload) => {
    const { data } = await client.post(`/vendor/dashboard/orders/${id}/tracking/events`, payload);
    return data;
  },

  /* ── Reviews ─────────────────────────────────────────────────────────── */
  getReviewStats: async (params) => {
    const { data } = await client.get('/vendor/dashboard/reviews/stats', { params });
    return data;
  },
  getReviews: async (params) => {
    const { data } = await client.get('/vendor/dashboard/reviews', { params });
    return data;
  },
  respondToReview: async (id, body) => {
    const { data } = await client.post(`/vendor/dashboard/reviews/${id}/response`, { body });
    return data;
  },
  clearReviewResponse: async (id) => {
    const { data } = await client.delete(`/vendor/dashboard/reviews/${id}/response`);
    return data;
  },
  hideReview: async (id, reason) => {
    const { data } = await client.patch(`/vendor/dashboard/reviews/${id}/hide`, { reason });
    return data;
  },
  unhideReview: async (id) => {
    const { data } = await client.patch(`/vendor/dashboard/reviews/${id}/unhide`);
    return data;
  },

  /* ── Analytics (granular) ────────────────────────────────────────────── */
  getAnalyticsOverviewFull: async (params) => {
    const { data } = await client.get('/vendor/dashboard/analytics/overview', { params });
    return data;
  },
  getSalesTrend: async (params) => {
    const { data } = await client.get('/vendor/dashboard/analytics/sales-trend', { params });
    return data;
  },
  getOrderBreakdown: async (params) => {
    const { data } = await client.get('/vendor/dashboard/analytics/order-breakdown', { params });
    return data;
  },
  getCustomerInsights: async (params) => {
    const { data } = await client.get('/vendor/dashboard/analytics/customers', { params });
    return data;
  },
  getCategoryBreakdown: async (params) => {
    const { data } = await client.get('/vendor/dashboard/analytics/category-breakdown', { params });
    return data;
  },

  /* ── Reports ─────────────────────────────────────────────────────────── */
  getSalesReport: async (params) => {
    const { data } = await client.get('/vendor/dashboard/reports/sales', { params });
    return data;
  },
  getSalesReportCsv: async (params) => {
    const response = await client.get('/vendor/dashboard/reports/sales', {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    });
    return response.data;
  },
  getProductReport: async (params) => {
    const { data } = await client.get('/vendor/dashboard/reports/products', { params });
    return data;
  },
  getProductReportCsv: async (params) => {
    const response = await client.get('/vendor/dashboard/reports/products', {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    });
    return response.data;
  },
};
