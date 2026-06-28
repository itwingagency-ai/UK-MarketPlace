import { useState, useEffect, useCallback } from 'react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, StatCard, Skeleton } from '../../components/common';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  DollarSign, Package, ShoppingCart, TrendingUp,
  Users, BarChart3,
} from 'lucide-react';

/* ── Chart Colors ─────────────────────────────────────────────────── */
const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

/* ── Period presets ────────────────────────────────────────────────── */
const PERIODS = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
];

function toISODate(d) { return d.toISOString().split('T')[0]; }

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

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div style={{
      background: 'var(--aa-panel-bg)', border: '1px solid var(--aa-panel-border)',
      borderRadius: 'var(--radius-lg)', padding: '0.5rem 0.75rem',
      boxShadow: 'var(--shadow-lg)', fontSize: 'var(--text-sm)',
    }}>
      <div style={{ fontWeight: 600 }}>{entry.name}</div>
      <div style={{ color: entry.payload.fill }}>{entry.value} orders</div>
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
function AnalyticsSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Analytics" subtitle="Sales trends and performance insights." />
      <div className="kpi-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div className="card" key={i} style={{ padding: 'var(--space-4)' }}>
            <Skeleton variant="text" width="50%" height="0.75rem" />
            <div style={{ marginTop: 'var(--space-3)' }}><Skeleton variant="text" width="35%" height="1.5rem" /></div>
          </div>
        ))}
      </div>
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

export default function VendorAnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  // Data slices
  const [overview, setOverview] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [orderBreakdown, setOrderBreakdown] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [customerInsights, setCustomerInsights] = useState(null);

  const buildDateParams = useCallback(() => {
    const preset = PERIODS.find(p => p.key === period);
    if (!preset) return {};
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - preset.days);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }, [period]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const dateParams = buildDateParams();
      const params = { ...dateParams, compareToPrevious: 'true' };

      const [ovRes, trendRes, orderBrRes, catRes, custRes] = await Promise.allSettled([
        vendorService.getAnalyticsOverviewFull(params),
        vendorService.getSalesTrend({ ...dateParams, granularity: 'daily' }),
        vendorService.getOrderBreakdown(dateParams),
        vendorService.getCategoryBreakdown(dateParams),
        vendorService.getCustomerInsights(dateParams),
      ]);

      if (ovRes.status === 'fulfilled') {
        setOverview(ovRes.value);
        setTopProducts((ovRes.value?.topProducts || []).slice(0, 6));
      }
      if (trendRes.status === 'fulfilled') setSalesTrend(trendRes.value?.data || []);
      if (orderBrRes.status === 'fulfilled') {
        const raw = orderBrRes.value?.data || {};
        setOrderBreakdown(
          Object.entries(raw)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value }))
        );
      }
      if (catRes.status === 'fulfilled') setCategoryBreakdown(catRes.value?.data || []);
      if (custRes.status === 'fulfilled') setCustomerInsights(custRes.value?.data || null);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [buildDateParams]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) return <AnalyticsSkeleton />;

  const current = overview?.current || overview || {};
  const delta = overview?.comparison?.delta || {};

  // Prepare top products for bar chart
  const topProductsChart = topProducts.map(p => ({
    name: p.name?.length > 15 ? p.name.substring(0, 15) + '…' : (p.name || 'Unknown'),
    revenue: p.revenue || 0,
    sales: p.sales || p.unitsSold || 0,
  }));

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Analytics"
        subtitle="Sales trends and performance insights."
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Analytics' },
        ]}
        actions={
          <div className="period-tabs">
            {PERIODS.map(p => (
              <button key={p.key}
                className={`period-tab${period === p.key ? ' active' : ''}`}
                onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ── KPI Stat Cards ── */}
      <div className="kpi-grid">
        <StatCard
          label="Revenue"
          value={`£${Number(current.revenue || 0).toFixed(2)}`}
          trend={delta.revenue}
          trendLabel="vs prev period"
          icon={<DollarSign size={18} />}
          color="#6366f1"
        />
        <StatCard
          label="Net Payout"
          value={`£${Number(current.netPayout || 0).toFixed(2)}`}
          trend={delta.netPayout}
          trendLabel="vs prev period"
          icon={<TrendingUp size={18} />}
          color="#10b981"
        />
        <StatCard
          label="Total Orders"
          value={current.totalOrders || 0}
          trend={delta.totalOrders}
          trendLabel="vs prev period"
          icon={<ShoppingCart size={18} />}
          color="#8b5cf6"
        />
        <StatCard
          label="Avg Order Value"
          value={`£${Number(current.averageOrderValue || 0).toFixed(2)}`}
          trend={delta.averageOrderValue}
          trendLabel="vs prev period"
          icon={<BarChart3 size={18} />}
          color="#f59e0b"
        />
        <StatCard
          label="Items Sold"
          value={current.itemsSold || 0}
          trend={delta.itemsSold}
          trendLabel="vs prev period"
          icon={<Package size={18} />}
          color="#ef4444"
        />
        <StatCard
          label="Unique Customers"
          value={current.uniqueCustomers || 0}
          trend={delta.uniqueCustomers}
          trendLabel="vs prev period"
          icon={<Users size={18} />}
          color="#06b6d4"
        />
      </div>

      {/* ── Row 1: Sales Trend + Order Breakdown ── */}
      <div className="charts-grid-2">
        {/* Sales Trend (Area) */}
        <div className="card">
          <div className="card-header"><h3>Sales Trend</h3></div>
          <div className="card-body" style={{ paddingBottom: 'var(--space-2)' }}>
            {salesTrend.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <div className="empty-state-icon"><BarChart3 size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-md)' }}>No sales data</h3>
                <p>Sales trend data will appear once orders come in.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
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

        {/* Order Status Breakdown (Pie) */}
        <div className="card">
          <div className="card-header"><h3>Order Breakdown</h3></div>
          <div className="card-body">
            {orderBreakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <div className="empty-state-icon"><ShoppingCart size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-md)' }}>No order data</h3>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
                <PieChart>
                  <Pie data={orderBreakdown} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                    paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}
                    style={{ fontSize: 'var(--text-xs)' }}>
                    {orderBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 'var(--text-xs)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Category Breakdown + Top Products ── */}
      <div className="charts-grid-equal">
        {/* Category Revenue (Bar) */}
        <div className="card">
          <div className="card-header"><h3>Revenue by Category</h3></div>
          <div className="card-body">
            {categoryBreakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <div className="empty-state-icon"><BarChart3 size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-md)' }}>No category data</h3>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryBreakdown.slice(0, 8)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--aa-panel-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={28}>
                    {categoryBreakdown.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products (Horizontal Bar) */}
        <div className="card">
          <div className="card-header"><h3>Top Products</h3></div>
          <div className="card-body">
            {topProductsChart.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <div className="empty-state-icon"><Package size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-md)' }}>No product data yet</h3>
                <p>Product performance will appear once you start getting sales.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topProductsChart} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--aa-panel-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                  <YAxis type="category" dataKey="name" width={90}
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
                    {topProductsChart.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Customer Insights ── */}
      {customerInsights && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="card-header"><h3>Customer Insights</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: '#6366f1' }}>
                  {customerInsights.totalCustomers || 0}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Total Customers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: '#10b981' }}>
                  {customerInsights.newCustomers || 0}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>New Customers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: '#8b5cf6' }}>
                  {customerInsights.returningCustomers || 0}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Returning Customers</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
