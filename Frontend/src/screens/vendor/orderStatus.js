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
  ready_for_collection: { label: 'Ready to collect', tone: 'primary' },
  collected: { label: 'Collected', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

// The main "next step" button for each status
export const NEXT_STEP = {
  pending: { status: 'confirmed', label: 'Accept order', icon: 'check' },
  confirmed: { status: 'packed', label: 'Mark as packed', icon: 'package' },
  packed: { status: 'shipped', label: 'Send out for delivery', icon: 'truck' },
  shipped: { status: 'delivered', label: 'Mark as delivered', icon: 'check-circle' },
};

// Collection orders skip delivery: they're made ready, then handed over
const COLLECTION_NEXT_STEP = {
  pending: NEXT_STEP.pending,
  confirmed: { status: 'ready_for_collection', label: 'Ready to collect', icon: 'shopping-bag' },
  packed: { status: 'ready_for_collection', label: 'Ready to collect', icon: 'shopping-bag' },
  ready_for_collection: { status: 'collected', label: 'Handed over', icon: 'check-circle' },
};

export const nextStepFor = (order) =>
  (order?.fulfilment?.method === 'collection' ? COLLECTION_NEXT_STEP : NEXT_STEP)[order?.orderStatus];

export const CANCELLABLE = new Set(['pending', 'confirmed', 'packed', 'ready_for_collection']);

/** "ASAP" or "Tue 17 Nov, 10:00–11:00" in the phone's time (UK stores, UK phones). */
export const slotText = (f) => {
  if (!f || f.asap !== false || !f.slotStart) return 'ASAP';
  const start = new Date(f.slotStart);
  // Slots are store-local (UK) times, whatever timezone the phone is in
  const tz = { timeZone: 'Europe/London' };
  const t = (d) => d.toLocaleTimeString('en-GB', { ...tz, hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('en-GB', { ...tz, weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${t(start)}${f.slotEnd ? `–${t(new Date(f.slotEnd))}` : ''}`;
};

/** A collecting customer who said they're outside and hasn't been served yet. */
export const isWaitingOutside = (order) =>
  order?.fulfilment?.method === 'collection' &&
  Boolean(order.fulfilment.arrivedAt) &&
  !['collected', 'cancelled'].includes(order.orderStatus);

export const ORDER_FILTERS = [
  ['', 'All'],
  ['pending', 'New'],
  ['confirmed', 'Accepted'],
  ['packed', 'Packed'],
  ['shipped', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['ready_for_collection', 'Ready to collect'],
  ['collected', 'Collected'],
  ['cancelled', 'Cancelled'],
];
