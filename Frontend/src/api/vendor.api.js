import client from './client';

/**
 * Shopkeeper (vendor) API — the same /vendor/dashboard endpoints the web
 * dashboard uses. The server scopes every call to the signed-in vendor's store.
 */
const V = '/vendor/dashboard';

// Multipart uploads: let the runtime set the boundary header
const multipart = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 };

/* ── Overview ─────────────────────────────────────────────────────────── */
export const getOverview = async () => (await client.get(`${V}/overview`)).data;
export const getStockSummary = async () => (await client.get(`${V}/products/stock-summary`)).data;

/* ── Categories ───────────────────────────────────────────────────────── */
export const getCategories = async () => (await client.get(`${V}/categories`)).data;
export const createCategory = async (form) => (await client.post(`${V}/categories`, form, multipart)).data;
export const updateCategory = async (id, body) =>
  (await client.patch(`${V}/categories/${id}`, body, body instanceof FormData ? multipart : undefined)).data;
export const deleteCategory = async (id) => (await client.delete(`${V}/categories/${id}`)).data;

/* ── Products ─────────────────────────────────────────────────────────── */
export const getProducts = async (params) => (await client.get(`${V}/products`, { params })).data;
export const getProduct = async (id) => (await client.get(`${V}/products/${id}`)).data;
export const createProduct = async (form) => (await client.post(`${V}/products`, form, multipart)).data;
export const updateProduct = async (id, body) =>
  (await client.patch(`${V}/products/${id}`, body, body instanceof FormData ? multipart : undefined)).data;
// Soft delete: hides the product from customers
export const hideProduct = async (id) => (await client.delete(`${V}/products/${id}`)).data;
export const showProduct = async (id) => (await client.patch(`${V}/products/${id}/restore`)).data;
export const deleteProductPermanently = async (id) =>
  (await client.delete(`${V}/products/${id}`, { params: { hard: 'true' } })).data;
// { adjust, variantId? } — atomic change, never undoes a concurrent sale
export const adjustStock = async (id, body) => (await client.patch(`${V}/products/${id}/stock`, body)).data;

/* ── Orders ───────────────────────────────────────────────────────────── */
export const getOrders = async (params) => (await client.get(`${V}/orders`, { params })).data;
export const getOrder = async (id) => (await client.get(`${V}/orders/${id}`)).data;
export const updateOrderStatus = async (id, body) => (await client.patch(`${V}/orders/${id}/status`, body)).data;
// Delivery riders (vendor-employed) and changing items while packing
export const getRiders = async () => (await client.get(`${V}/riders`)).data;
export const assignRider = async (id, riderId) => (await client.patch(`${V}/orders/${id}/rider`, { riderId })).data;
export const adjustOrderItem = async (id, index, body) => (await client.patch(`${V}/orders/${id}/items/${index}`, body)).data;

/* ── Store ────────────────────────────────────────────────────────────── */
export const getStoreSettings = async () => (await client.get(`${V}/settings`)).data;
export const updateStoreSettings = async (body) =>
  (await client.patch(`${V}/settings`, body, body instanceof FormData ? multipart : undefined)).data;
export const getOperatingHours = async () => (await client.get(`${V}/operating-hours`)).data;
export const replaceOperatingHours = async (schedule) =>
  (await client.put(`${V}/operating-hours`, { schedule })).data;
export const getLocation = async () => (await client.get(`${V}/location`)).data;
// Busy mode: pause new orders for `minutes`, or 0 to resume
export const setBusy = async (minutes) => (await client.patch(`${V}/busy`, { minutes })).data;

/* ── Becoming a shopkeeper (customer accounts) ────────────────────────── */
export const getMyApplication = async () => (await client.get('/vendor-applications/me')).data;
export const submitApplication = async (body) => (await client.post('/vendor-applications', body)).data;
