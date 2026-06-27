import { useState, useEffect } from 'react';
import { vendorService } from '../../api/vendorService';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react';

export default function VendorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getAnalyticsOverview();
      setData(res);
    } catch (error) {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h3>Loading Analytics...</h3></div>;
  }

  // Provide fallback mock data if backend sends null or empty
  const safeData = data || {
    totalRevenue: 0,
    totalOrders: 0,
    salesTrend: [
      { date: 'Mon', revenue: 0 },
      { date: 'Tue', revenue: 0 },
      { date: 'Wed', revenue: 0 },
      { date: 'Thu', revenue: 0 },
      { date: 'Fri', revenue: 0 },
      { date: 'Sat', revenue: 0 },
      { date: 'Sun', revenue: 0 },
    ],
    topProducts: [],
  };

  const maxRevenue = Math.max(...safeData.salesTrend.map(d => d.revenue), 100);

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Analytics Overview</h1>
          <p>Sales trends and top performing products.</p>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Period Revenue</span>
            <div className="stat-card-icon primary">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="stat-card-value">£{Number(safeData.totalRevenue).toFixed(2)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Period Orders</span>
            <div className="stat-card-icon success">
              <Package size={18} />
            </div>
          </div>
          <div className="stat-card-value">{safeData.totalOrders}</div>
        </div>
      </div>

      <div className="grid grid-cols-3" style={{ gap: 'var(--space-6)' }}>
        {/* Sales Trend Bar Chart (CSS-based) */}
        <div className="card col-span-2">
          <div className="card-header">
            <h3>Sales Trend (Last 7 Days)</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '250px', gap: '1rem', paddingTop: '1rem' }}>
              {safeData.salesTrend.map((item, index) => {
                const heightPercent = Math.max((item.revenue / maxRevenue) * 100, 2); // minimum 2% height
                return (
                  <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                      <div 
                        style={{ 
                          width: '100%', 
                          backgroundColor: 'var(--primary)', 
                          height: `${heightPercent}%`,
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease'
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

        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <h3>Top Products</h3>
          </div>
          <div className="card-body p-0">
            {safeData.topProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <Package size={24} style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ marginTop: '0.5rem' }}>No product data available yet.</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {safeData.topProducts.map((product, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{product.name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{product.sales} sales</div>
                    </div>
                    <div style={{ fontWeight: '600' }}>
                      £{product.revenue.toFixed(2)}
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
