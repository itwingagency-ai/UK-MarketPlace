/**
 * Format a number as GBP currency.
 */
export function formatCurrency(amount, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string to a readable format.
 */
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
