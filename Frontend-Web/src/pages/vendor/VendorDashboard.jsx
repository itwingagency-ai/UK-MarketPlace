import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  Star,
} from 'lucide-react';

/* ── Placeholder stat data ──────────────────────────────────────────── */
const stats = [
  { label: 'Total Sales', value: '£0', icon: DollarSign, variant: 'primary', trend: null },
  { label: 'Orders', value: '0', icon: ShoppingCart, variant: 'success', trend: null },
  { label: 'Products', value: '0', icon: Package, variant: 'warning', trend: null },
  { label: 'Avg Rating', value: '—', icon: Star, variant: 'info', trend: null },
];

export default function VendorDashboard() {
  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Store Dashboard</h1>
          <p>Your store's performance at a glance</p>
        </div>
        <div className="page-header-actions">
          <span className="badge badge-success">
            <span className="badge-dot" />
            Store Active
          </span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
        {stats.map((s) => (
          <div className="card stat-card" key={s.label}>
            <div className="stat-card-header">
              <span className="stat-card-label">{s.label}</span>
              <div className={`stat-card-icon ${s.variant}`}>
                <s.icon size={18} />
              </div>
            </div>
            <div className="stat-card-value">{s.value}</div>
            {s.trend && (
              <span className={`stat-card-trend ${s.trend > 0 ? 'up' : 'down'}`}>
                <TrendingUp size={12} />
                {Math.abs(s.trend)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Placeholder Panels ── */}
      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3>Revenue Trend</h3>
            <span className="badge badge-neutral">Coming in Phase 4</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">
                <TrendingUp size={24} />
              </div>
              <h3>Sales Chart</h3>
              <p>Your revenue trend chart will appear here once the vendor dashboard module is built.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Orders</h3>
            <span className="badge badge-neutral">Coming in Phase 6</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">
                <ShoppingCart size={24} />
              </div>
              <h3>Order Feed</h3>
              <p>Your latest orders will be listed here once the order module is complete.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
