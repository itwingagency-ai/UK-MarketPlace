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
  confirmed:  'info',
  accepted:   'info',
  preparing:  'info',
  packed:     'info',
  shipped:    'primary',
  dispatched: 'primary',
  delivered:  'success',
  cancelled:  'danger',

  // Payment statuses
  paid:       'success',
  failed:     'danger',
  refunded:   'neutral',

  // Shipment events
  created:            'neutral',
  picked_up:          'info',
  in_transit:         'primary',
  out_for_delivery:   'primary',
  delivery_attempted: 'warning',
  exception:          'danger',

  // Collection orders
  ready_for_collection: 'primary',
  collected:            'success',

  // Vendor application statuses
  approved:   'success',
  rejected:   'danger',

  // Users / stores / generic
  active:     'success',
  suspended:  'danger',
  unverified: 'warning',
  inactive:   'neutral',
  draft:      'neutral',
  published:  'success',
};

const VARIANT_CLASSES = {
  primary: 'badge-primary',
  success: 'badge-success',
  danger:  'badge-danger',
  warning: 'badge-warning',
  info:    'badge-info',
  neutral: 'badge-neutral',
};

export default function StatusBadge({ status, label, size = 'md', dot = true }) {
  const variant = STATUS_MAP[status?.toLowerCase()] || 'neutral';
  const className = `badge ${VARIANT_CLASSES[variant]}${size === 'sm' ? ' badge-sm' : ''}`;
  const displayText = (label || status || 'Unknown').replace(/_/g, ' ');

  return (
    <span className={className}>
      {dot && <div className="badge-dot" />}
      {displayText.charAt(0).toUpperCase() + displayText.slice(1).toLowerCase()}
    </span>
  );
}
