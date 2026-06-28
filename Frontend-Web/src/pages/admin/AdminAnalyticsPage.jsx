import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, StatCard, Skeleton } from '../../components/common';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  DollarSign, ShoppingCart, TrendingUp,
  BarChart3, Store,
} from 'lucide-react';

/* ── Chart Colors ─────────────────────────────────────────────────── */
const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

/* ── Custom Recharts Tooltips ──────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--aa-panel-bg)', border: '1px solid var(--aa-panel-border)',
      borderRadius: 'var(--radius-lg)', padding: '0.625rem 0.875rem',
      boxShadow: 'var(--shadow-lg)', fontSize: 'var(--text-sm)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('value')
              ? `£${Number(p.value).toFixed(2)}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
function AnalyticsSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Platform Analytics" subtitle="Platform-wide growth metrics and performance charts." />
      <div className="charts-grid-2">
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <Skeleton variant="rect" height={280} />
        </div>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <Skeleton variant="rect" height={280} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);

  // Data slices
  const [salesTrend, setSalesTrend] = useState([]);
  const [topStores, setTopStores] = useState([]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const [trendRes, topStoresRes] = await Promise.allSettled([
        adminService.getSalesAnalytics({ days: 30 }),
        adminService.getTopStores({ limit: 10 }),
      ]);

      if (trendRes.status === 'fulfilled') {
        setSalesTrend(trendRes.value?.data?.series || []);
      }
      if (topStoresRes.status === 'fulfilled') {
        const storesData = topStoresRes.value?.data || [];
        const stores = storesData.map(s => ({
          _id: s.storeId,
          name: s.storeName,
          slug: s.storeSlug,
          totalOrders: s.orderCount,
          totalRevenue: s.revenue
        }));
        setTopStores(stores);
      }
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) return <AnalyticsSkeleton />;

  // Prepare top stores for bar chart
  const topStoresChart = topStores.map(p => ({
    name: p.name?.length > 15 ? p.name.substring(0, 15) + '…' : (p.name || 'Unknown'),
    revenue: p.totalRevenue || 0,
    orders: p.totalOrders || 0,
  }));

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Platform Analytics"
        subtitle="Platform-wide growth metrics and performance charts."
      />

      <div className="charts-grid-2">
        {/* Sales Trend (Area) */}
        <div className="card">
          <div className="card-header"><h3>Platform Revenue (Last 30 Days)</h3></div>
          <div className="card-body" style={{ paddingBottom: 'var(--space-2)' }}>
            {salesTrend.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <div className="empty-state-icon"><BarChart3 size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-md)' }}>No sales data</h3>
                <p>Sales trend data will appear once orders come in.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--aa-panel-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    axisLine={{ stroke: 'var(--aa-panel-border)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    dot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Stores (Horizontal Bar) */}
        <div className="card">
          <div className="card-header"><h3>Top Stores by Revenue</h3></div>
          <div className="card-body">
            {topStoresChart.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <div className="empty-state-icon"><Store size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-md)' }}>No store data yet</h3>
                <p>Store performance will appear once sales occur.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topStoresChart} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--aa-panel-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                  <YAxis type="category" dataKey="name" width={90}
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
                    {topStoresChart.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
