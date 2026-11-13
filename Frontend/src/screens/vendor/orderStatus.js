/**
 * Order statuses as shopkeepers see them. The server enforces the allowed
 * transitions (Backend/src/validators/order.validator.js); this only decides
 * which buttons to offer.
 */
export const ORDER_STATUS_META = {
  pending: { label: 'New', tone: 'warning' },
  confirmed: { label: 'Accepted', tone: 'info' },
  packed: { label: 'Packed', tone: 'info' },
  shipped: { label: 'Out for delivery', tone: 'primary' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

// The main "next step" button for each status
export const NEXT_STEP = {
  pending: { status: 'confirmed', label: 'Accept order', icon: 'check' },
  confirmed: { status: 'packed', label: 'Mark as packed', icon: 'package' },
  packed: { status: 'shipped', label: 'Send out for delivery', icon: 'truck' },
  shipped: { status: 'delivered', label: 'Mark as delivered', icon: 'check-circle' },
};

export const CANCELLABLE = new Set(['pending', 'confirmed', 'packed']);

export const ORDER_FILTERS = [
  ['', 'All'],
  ['pending', 'New'],
  ['confirmed', 'Accepted'],
  ['packed', 'Packed'],
  ['shipped', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];
