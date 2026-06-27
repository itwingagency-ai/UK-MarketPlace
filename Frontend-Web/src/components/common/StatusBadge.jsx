/**
 * <StatusBadge> — colour-coded status chips.
 *
 * Props:
 *   status  – string (mapped to variant colour)
 *   label   – string (display text; falls back to status)
 *   size    – 'sm' | 'md' (default 'md')
 *   dot     – boolean (show coloured dot, default true)
 */

const STATUS_MAP = {
  // Order statuses
  pending:    'warning',
  accepted:   'info',
  preparing:  'info',
  packed:     'info',
  dispatched: 'info',
  delivered:  'success',
  cancelled:  'danger',
  refunded:   'danger',

  // Vendor application statuses
  approved:   'success',
  rejected:   'danger',

  // Generic
  active:     'success',
  suspended:  'danger',
  inactive:   'neutral',
  draft:      'neutral',
  published:  'success',
};

const VARIANT_CLASSES = {
  success: 'badge-success',
  danger:  'badge-danger',
  warning: 'badge-warning',
  info:    'badge-info',
  neutral: 'badge-neutral',
};

export default function StatusBadge({ status, label, size = 'md', dot = true }) {
  const variant = STATUS_MAP[status?.toLowerCase()] || 'neutral';
  const className = `badge ${VARIANT_CLASSES[variant]}${size === 'sm' ? ' badge-sm' : ''}`;
  const displayText = label || status || 'Unknown';

  return (
    <span className={className}>
      {dot && <div className="badge-dot" />}
      {displayText.charAt(0).toUpperCase() + displayText.slice(1).toLowerCase()}
    </span>
  );
}
