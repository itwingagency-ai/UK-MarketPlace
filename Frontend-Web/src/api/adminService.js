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

  /* ── Category Studio (global categories) ── */
  getGlobalCategories: async () => {
    const { data } = await client.get('/admin/global-categories');
    return data;
  },
  createGlobalCategory: async (payload) => {
    const { data } = await client.post('/admin/global-categories', payload);
    return data;
  },
  updateGlobalCategory: async (id, payload) => {
    const { data } = await client.patch(`/admin/global-categories/${id}`, payload);
    return data;
  },
  reorderGlobalCategories: async (items) => {
    const { data } = await client.patch('/admin/global-categories/reorder', { items });
    return data;
  },
  deleteGlobalCategory: async (id, replacement) => {
    const { data } = await client.delete(`/admin/global-categories/${id}`, {
      params: replacement ? { replacement } : undefined,
    });
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

  /* ── Coupons, automatic offers, redemptions (money in pence) ── */
  getCoupons: async (params) => {
    const { data } = await client.get('/admin/coupons', { params });
    return data;
  },
  createCoupon: async (payload) => {
    const { data } = await client.post('/admin/coupons', payload);
    return data;
  },
  updateCoupon: async (id, payload) => {
    const { data } = await client.patch(`/admin/coupons/${id}`, payload);
    return data;
  },
  deleteCoupon: async (id) => {
    const { data } = await client.delete(`/admin/coupons/${id}`);
    return data;
  },
  getCouponRedemptions: async (params) => {
    const { data } = await client.get('/admin/coupons/redemptions', { params });
    return data;
  },
  getPromotions: async (params) => {
    const { data } = await client.get('/admin/promotions', { params });
    return data;
  },
  createPromotion: async (payload) => {
    const { data } = await client.post('/admin/promotions', payload);
    return data;
  },
  updatePromotion: async (id, payload) => {
    const { data } = await client.patch(`/admin/promotions/${id}`, payload);
    return data;
  },
  deletePromotion: async (id) => {
    const { data } = await client.delete(`/admin/promotions/${id}`);
    return data;
  },

  /* ── Rewards points and referrals ── */
  getLoyaltyLedger: async (params) => {
    const { data } = await client.get('/admin/loyalty/ledger', { params });
    return data;
  },
  adjustLoyalty: async (payload) => {
    const { data } = await client.post('/admin/loyalty/adjust', payload);
    return data;
  },
  getReferrals: async (params) => {
    const { data } = await client.get('/admin/referrals', { params });
    return data;
  },
  reviewReferral: async (id, payload) => {
    const { data } = await client.patch(`/admin/referrals/${id}`, payload);
    return data;
  },

  /* ── Home banners ── */
  getBanners: async () => {
    const { data } = await client.get('/admin/banners');
    return data;
  },
  createBanner: async (formData) => {
    const { data } = await client.post('/admin/banners', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  },
  updateBanner: async (id, formData) => {
    const { data } = await client.patch(`/admin/banners/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  },
  deleteBanner: async (id) => {
    const { data } = await client.delete(`/admin/banners/${id}`);
    return data;
  },
};
