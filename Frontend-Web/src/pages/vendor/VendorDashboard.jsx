import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { vendorService } from '../../api/vendorService';
import { PageHeader, StatusBadge, Skeleton } from '../../components/common';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  Star,
  Activity,
  Settings,
  Truck,
  Clock,
  MapPin,
  ArrowRight,
} from 'lucide-react';

/* ── Quick Action Links ─────────────────────────────────────────────── */
const quickActions = [
  { to: '/vendor/products', icon: Package, label: 'Products', color: '#6366f1' },
  { to: '/vendor/orders', icon: ShoppingCart, label: 'Orders', color: '#10b981' },
  { to: '/vendor/settings', icon: Settings, label: 'Settings', color: '#f59e0b' },
  { to: '/vendor/shipping', icon: Truck, label: 'Shipping', color: '#8b5cf6' },
  { to: '/vendor/operating-hours', icon: Clock, label: 'Hours', color: '#ec4899' },
  { to: '/vendor/analytics', icon: TrendingUp, label: 'Analytics', color: '#06b6d4' },
];

/* ── Stat Config ────────────────────────────────────────────────────── */
const statConfig = [
  { key: 'totalSales', label: 'Total Revenue', prefix: '£', icon: DollarSign, color: '#6366f1' },
  { key: 'totalOrders', label: 'Orders', prefix: '', icon: ShoppingCart, color: '#10b981' },
  { key: 'totalProducts', label: 'Products', prefix: '', icon: Package, color: '#f59e0b' },
  { key: 'averageRating', label: 'Avg Rating', prefix: '', icon: Star, color: '#ec4899', decimals: 1 },
];

/* ── Custom Recharts Tooltip ────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--aa-panel-bg)',
      border: '1px solid var(--aa-panel-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '0.625rem 0.875rem',
      boxShadow: 'var(--shadow-lg)',
      fontSize: 'var(--text-sm)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: 'var(--primary)' }}>£{Number(payload[0].value).toFixed(2)}</div>
    </div>
  );
}

/* ── Dashboard Skeleton ─────────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Store Dashboard" subtitle="Your store's performance at a glance" />

      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[1, 2, 3, 4].map((i) => (
          <div className="card" key={i} style={{ padding: 'var(--space-5)' }}>
            <Skeleton variant="text" width="60%" height="0.75rem" />
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Skeleton variant="text" width="40%" height="1.5rem" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <Skeleton variant="text" width="30%" height="1rem" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton variant="rect" height={220} />
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <Skeleton variant="text" width="30%" height="1rem" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton variant="text" count={5} height="2.5rem" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function VendorDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getDashboardOverview();
      setData(res);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  /* ── Map backend response safely ── */
  const safeData = {
    totalSales: data?.metrics?.totalRevenue || 0,
    totalOrders: data?.metrics?.totalOrders || 0,
    totalProducts: data?.metrics?.totalProducts || 0,
    averageRating: data?.metrics?.averageRating || 0,
    revenueTrend: data?.revenueTrend || [
      { date: 'Mon', revenue: 0 },
      { date: 'Tue', revenue: 0 },
      { date: 'Wed', revenue: 0 },
      { date: 'Thu', revenue: 0 },
      { date: 'Fri', revenue: 0 },
      { date: 'Sat', revenue: 0 },
      { date: 'Sun', revenue: 0 },
    ],
    recentOrders: data?.recentOrders || [],
    trends: data?.trends || {},
  };

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Store Dashboard"
        subtitle="Your store's performance at a glance"
        actions={
          <span className="badge badge-success">
            <span className="badge-dot" />
            Store Active
          </span>
        }
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
        {statConfig.map((s) => {
          const raw = safeData[s.key];
          const value = s.decimals
            ? Number(raw).toFixed(s.decimals)
            : s.prefix
            ? Number(raw).toFixed(2)
            : raw;
          const trend = safeData.trends?.[s.key] ?? null;

          return (
            <div className="card stat-card" key={s.key}>
              <div className="stat-card-header">
                <span className="stat-card-label">{s.label}</span>
                <div
                  className="stat-card-icon"
                  style={{ background: `${s.color}15`, color: s.color }}
                >
                  <s.icon size={18} />
                </div>
              </div>
              <div className="stat-card-value">
                {s.prefix}{value || '—'}
              </div>
              {trend !== null && trend !== undefined && (
                <span className={`stat-card-trend ${trend >= 0 ? 'up' : 'down'}`}>
                  <TrendingUp size={12} style={trend < 0 ? { transform: 'rotate(180deg)' } : {}} />
                  {Math.abs(trend).toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Revenue Trend (Recharts) */}
        <div className="card">
          <div className="card-header">
            <h3>Revenue Trend</h3>
          </div>
          <div className="card-body" style={{ paddingBottom: 'var(--space-2)' }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={safeData.revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--aa-panel-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={{ stroke: 'var(--aa-panel-border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `£${v}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#revGradient)"
                  dot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3>Recent Orders</h3>
            {safeData.recentOrders.length > 0 && (
              <Link to="/vendor/orders" className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--text-sm)' }}>
                View All <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <div className="card-body p-0">
            {safeData.recentOrders.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">
                  <Activity size={24} />
                </div>
                <h3>No recent orders</h3>
                <p>When you start receiving orders, they will appear here.</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {safeData.recentOrders.slice(0, 6).map((order) => (
                  <li
                    key={order._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background var(--transition-fast)',
                    }}
                    className="hover-row"
                  >
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '0.2rem', fontSize: 'var(--text-md)' }}>
                        Order #{order.orderNumber || order._id.substring(0, 8)}
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                        £{Number(order.totalAmount).toFixed(2)}
                      </div>
                      <StatusBadge status={order.status} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="card">
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-6" style={{ gap: 'var(--space-3)' }}>
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="quick-action-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: 'var(--space-4) var(--space-2)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                  transition: 'all var(--transition-base)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.boxShadow = `0 2px 12px ${action.color}20`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: 40, height: 40,
                  borderRadius: 'var(--radius-lg)',
                  background: `${action.color}12`,
                  color: action.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <action.icon size={20} />
                </div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
