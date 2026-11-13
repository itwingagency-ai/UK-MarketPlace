/**
 * Application-wide constants.
 */

export const ROLES = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  CUSTOMER: 'customer',
};

export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'packed',
  'dispatched',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_COLORS = {
  pending: 'warning',
  accepted: 'info',
  preparing: 'info',
  packed: 'primary',
  dispatched: 'primary',
  delivered: 'success',
  cancelled: 'danger',
};

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'];

export const PAYMENT_STATUS_COLORS = {
  unpaid: 'warning',
  paid: 'success',
  refunded: 'info',
  failed: 'danger',
};

export const STORE_STATUSES = ['active', 'suspended'];

export const USER_STATUSES = ['active', 'suspended'];

export const PRODUCT_STATUSES = ['active', 'inactive', 'deleted'];

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Matches LOW_STOCK_THRESHOLD in Backend/src/lib/inventory.js
export const LOW_STOCK_THRESHOLD = 5;

// Product photo limits, matching the backend validator and upload middleware
export const MAX_PRODUCT_IMAGES = 10;
export const MAX_IMAGES_PER_UPLOAD = 5;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
