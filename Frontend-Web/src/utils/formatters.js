/**
 * Format a number as GBP currency.
 */
export function formatCurrency(amount, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format((amount || 0) / 100);
}

/**
 * Format a date string to a readable format.
 */
/** "Tue 17 Nov, 10:00–11:00" for a booked slot; "ASAP" when there isn't one. */
export function formatSlot(fulfilment) {
  if (!fulfilment || fulfilment.asap !== false || !fulfilment.slotStart) return 'ASAP';
  const start = new Date(fulfilment.slotStart);
  const end = fulfilment.slotEnd ? new Date(fulfilment.slotEnd) : null;
  // Slots are store-local (UK) times, whatever timezone the browser is in
  const opts = { timeZone: 'Europe/London' };
  const day = start.toLocaleDateString('en-GB', { ...opts, weekday: 'short', day: 'numeric', month: 'short' });
  const t = (d) => d.toLocaleTimeString('en-GB', { ...opts, hour: '2-digit', minute: '2-digit' });
  return `${day}, ${t(start)}${end ? `–${t(end)}` : ''}`;
}

export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—';
  const defaults = { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-GB', { ...defaults, ...options });
}

/**
 * Format a date string to include time.
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate a string to maxLen characters with ellipsis.
 */
export function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}

/**
 * Capitalise first letter of each word.
 */
export function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build query string from params object, skipping empty values.
 */
export function buildQueryString(params) {
  const cleaned = Object.entries(params).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined
  );
  return new URLSearchParams(cleaned).toString();
}
