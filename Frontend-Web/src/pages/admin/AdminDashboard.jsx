import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  Users,
} from 'lucide-react';

/* ── Placeholder stat data ──────────────────────────────────────────── */
const stats = [
  { label: 'Total Revenue', value: '£0', icon: DollarSign, variant: 'primary', trend: null },
  { label: 'Total Orders', value: '0', icon: ShoppingCart, variant: 'success', trend: null },
  { label: 'Total Stores', value: '0', icon: Package, variant: 'warning', trend: null },
  { label: 'Total Users', value: '0', icon: Users, variant: 'info', trend: null },
];

export default function AdminDashboard() {
  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Dashboard</h1>
          <p>Platform overview and key performance indicators</p>
        </div>
        <div className="page-header-actions">
          <span className="badge badge-success">
            <span className="badge-dot" />
            System Online
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
            <h3>Recent Activity</h3>
            <span className="badge badge-neutral">Coming in Phase 7</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">
                <LayoutDashboard size={24} />
              </div>
              <h3>Activity Feed</h3>
              <p>Recent platform activity will appear here once the admin module is complete.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top Stores</h3>
            <span className="badge badge-neutral">Coming in Phase 7</span>
          </div>
          <div className="card-body">
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon">
                <TrendingUp size={24} />
              </div>
              <h3>Store Rankings</h3>
              <p>Top performing stores by revenue and order volume will be displayed here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
