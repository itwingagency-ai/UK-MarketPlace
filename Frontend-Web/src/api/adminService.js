import client from './client';

export const adminService = {
  /* ── Dashboard & Overview ── */
  getOverview: async () => {
    const { data } = await client.get('/admin/overview');
    return data;
  },
  getRecentActivity: async () => {
    const { data } = await client.get('/admin/activity');
    return data;
  },
  getSalesAnalytics: async (params) => {
    const { data } = await client.get('/admin/analytics/sales', { params });
    return data;
  },
  getTopStores: async (params) => {
    const { data } = await client.get('/admin/analytics/top-stores', { params });
    return data;
  },

  /* ── Users ── */
  getUsers: async (params) => {
    const { data } = await client.get('/admin/users', { params });
    return data;
  },
  getUserById: async (id) => {
    const { data } = await client.get(`/admin/users/${id}`);
    return data;
  },
  updateUser: async (id, payload) => {
    const { data } = await client.patch(`/admin/users/${id}`, payload);
    return data;
  },
  suspendUser: async (id, payload) => {
    const { data } = await client.patch(`/admin/users/${id}/suspend`, payload);
    return data;
  },
  reactivateUser: async (id) => {
    const { data } = await client.patch(`/admin/users/${id}/reactivate`);
    return data;
  },

  /* ── Stores ── */
  getStores: async (params) => {
    const { data } = await client.get('/admin/stores', { params });
    return data;
  },
  getStoreById: async (id) => {
    const { data } = await client.get(`/admin/stores/${id}`);
    return data;
  },
  updateStore: async (id, payload) => {
    const { data } = await client.patch(`/admin/stores/${id}`, payload);
    return data;
  },
  suspendStore: async (id, payload) => {
    const { data } = await client.patch(`/admin/stores/${id}/suspend`, payload);
    return data;
  },
  reactivateStore: async (id) => {
    const { data } = await client.patch(`/admin/stores/${id}/reactivate`);
    return data;
  },
  setStoreCommission: async (storeId, payload) => {
    const { data } = await client.patch(`/admin/stores/${storeId}/commission`, payload);
    return data;
  },

  /* ── Orders ── */
  getOrders: async (params) => {
    const { data } = await client.get('/admin/orders', { params });
    return data;
  },
  getOrderById: async (id) => {
    const { data } = await client.get(`/admin/orders/${id}`);
    return data;
  },

  /* ── Platform Settings & Commission ── */
  getSettings: async () => {
    const { data } = await client.get('/admin/settings');
    return data;
  },
  updateSettings: async (payload) => {
    const { data } = await client.patch('/admin/settings', payload);
    return data;
  },
  getCommissionSummary: async (params) => {
    const { data } = await client.get('/admin/commission/summary', { params });
    return data;
  },

  /* ── Notifications ── */
  getNotificationTemplates: async (params) => {
    const { data } = await client.get('/admin/notifications/templates', { params });
    return data;
  },
  getNotificationTemplate: async (eventType, channel) => {
    const { data } = await client.get(`/admin/notifications/templates/${eventType}/${channel}`);
    return data;
  },
  upsertNotificationTemplate: async (eventType, channel, payload) => {
    const { data } = await client.put(`/admin/notifications/templates/${eventType}/${channel}`, payload);
    return data;
  },
  deleteNotificationTemplate: async (eventType, channel) => {
    const { data } = await client.delete(`/admin/notifications/templates/${eventType}/${channel}`);
    return data;
  },
  getNotificationLog: async (params) => {
    const { data } = await client.get('/admin/notifications/log', { params });
    return data;
  },
  getNotificationLogById: async (id) => {
    const { data } = await client.get(`/admin/notifications/log/${id}`);
    return data;
  },

  /* ── Reviews & Moderation ── */
  getReviewReports: async (params) => {
    const { data } = await client.get('/admin/reviews/reports', { params });
    return data;
  },
  resolveReviewReport: async (id, payload) => {
    const { data } = await client.patch(`/admin/reviews/reports/${id}`, payload);
    return data;
  },
  getReviews: async (params) => {
    const { data } = await client.get('/admin/reviews', { params });
    return data;
  },
  getReviewById: async (id) => {
    const { data } = await client.get(`/admin/reviews/${id}`);
    return data;
  },
  updateReviewStatus: async (id, payload) => {
    const { data } = await client.patch(`/admin/reviews/${id}/status`, payload);
    return data;
  },
  deleteReview: async (id) => {
    const { data } = await client.delete(`/admin/reviews/${id}`);
    return data;
  },
};
