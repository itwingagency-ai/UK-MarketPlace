import { useState, useEffect } from 'react';
import { vendorService } from '../../api/vendorService';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  Star,
  Activity
} from 'lucide-react';

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

  if (loading) {
    return <div className="page-header"><h3>Loading Dashboard...</h3></div>;
  }

  // Map backend response safely
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
    recentOrders: data?.recentOrders || []
  };

  const stats = [
    { label: 'Total Sales', value: `£${Number(safeData.totalSales).toFixed(2)}`, icon: DollarSign, variant: 'primary', trend: null },
    { label: 'Orders', value: safeData.totalOrders.toString(), icon: ShoppingCart, variant: 'success', trend: null },
    { label: 'Products', value: safeData.totalProducts.toString(), icon: Package, variant: 'warning', trend: null },
    { label: 'Avg Rating', value: safeData.averageRating ? Number(safeData.averageRating).toFixed(1) : '—', icon: Star, variant: 'info', trend: null },
  ];

  const maxRevenue = Math.max(...safeData.revenueTrend.map(d => d.revenue), 100);

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

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        {/* Revenue Trend CSS Chart */}
        <div className="card">
          <div className="card-header">
            <h3>Revenue Trend</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '250px', gap: '1rem', paddingTop: '1rem' }}>
              {safeData.revenueTrend.map((item, index) => {
                const heightPercent = Math.max((item.revenue / maxRevenue) * 100, 2);
                return (
                  <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                      <div 
                        style={{ 
                          width: '100%', 
                          backgroundColor: 'var(--primary)', 
                          height: `${heightPercent}%`,
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                          opacity: 0.8
                        }} 
                        title={`£${item.revenue}`}
                      />
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3>Recent Orders</h3>
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
                {safeData.recentOrders.map(order => (
                  <li key={order._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Order #{order.orderNumber || order._id.substring(0, 8)}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>£{Number(order.totalAmount).toFixed(2)}</div>
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{order.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
