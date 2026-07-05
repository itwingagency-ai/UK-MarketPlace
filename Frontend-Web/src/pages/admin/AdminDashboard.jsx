import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  Store,
  FileText,
  UserPlus
} from 'lucide-react';
import { adminService } from '../../api/adminService';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

const getRelativeTime = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const getActivityConfig = (type) => {
  switch (type) {
    case 'order': return { icon: ShoppingCart, color: 'var(--status-green)', bg: 'var(--success-bg)' };
    case 'application': return { icon: FileText, color: 'var(--status-orange)', bg: 'var(--warning-bg)' };
    case 'store': return { icon: Store, color: 'var(--aa-green)', bg: 'var(--aa-green-light)' };
    case 'user': return { icon: UserPlus, color: 'var(--info-text)', bg: 'var(--info-bg)' };
    default: return { icon: LayoutDashboard, color: 'var(--gray-600)', bg: 'var(--gray-100)' };
  }
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    revenue: 0,
    orders: 0,
    stores: 0,
    users: 0
  });
  const [activity, setActivity] = useState([]);
  const [topStores, setTopStores] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // We'll fetch overview and try to fetch recent activity and top stores
        // We use Promise.allSettled to avoid one failure crashing everything if endpoints aren't perfectly aligned
        const [overviewRes, activityRes, topStoresRes] = await Promise.allSettled([
          adminService.getOverview(),
          adminService.getRecentActivity().catch(() => ({ data: [] })),
          adminService.getTopStores({ limit: 5 }).catch(() => ({ data: [] }))
        ]);

        if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
          const d = overviewRes.value.data;
          setStatsData({
            revenue: d.revenue?.gross || 0,
            orders: d.orders?.total || 0,
            stores: d.stores?.total || 0,
            users: d.users?.total || 0
          });
        }
        
        if (activityRes.status === 'fulfilled' && activityRes.value.data) {
          const actData = activityRes.value.data;
          const normalizedActivity = [];
          if (actData.recentOrders) {
            actData.recentOrders.forEach(o => normalizedActivity.push({
              type: 'order',
              description: `New order ${o.orderNumber || ''} placed`,
              createdAt: o.createdAt
            }));
          }
          if (actData.pendingApplications) {
            actData.pendingApplications.forEach(a => normalizedActivity.push({
              type: 'application',
              description: `New vendor application from ${a.applicant?.name || 'Unknown'}`,
              createdAt: a.createdAt
            }));
          }
          if (actData.recentStores) {
            actData.recentStores.forEach(s => normalizedActivity.push({
              type: 'store',
              description: `New store ${s.name} created`,
              createdAt: s.createdAt
            }));
          }
          if (actData.recentUsers) {
            actData.recentUsers.forEach(u => normalizedActivity.push({
              type: 'user',
              description: `New user ${u.name} registered`,
              createdAt: u.createdAt
            }));
          }
          normalizedActivity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setActivity(normalizedActivity.slice(0, 10));
        }

        if (topStoresRes.status === 'fulfilled' && topStoresRes.value.data) {
          const stores = topStoresRes.value.data.map(s => ({
            _id: s.storeId,
            name: s.storeName,
            slug: s.storeSlug,
            totalOrders: s.orderCount,
            totalRevenue: s.revenue
          }));
          setTopStores(stores);
        }

      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(statsData.revenue), icon: DollarSign, variant: 'primary', trend: null },
    { label: 'Total Orders', value: statsData.orders.toLocaleString(), icon: ShoppingCart, variant: 'success', trend: null },
    { label: 'Total Stores', value: statsData.stores.toLocaleString(), icon: Package, variant: 'warning', trend: null },
    { label: 'Total Users', value: statsData.users.toLocaleString(), icon: Users, variant: 'info', trend: null },
  ];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 rounded"></div>)}
        </div>
      </div>
    );
  }

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

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body">
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">
                  <LayoutDashboard size={24} />
                </div>
                <h3>No Recent Activity</h3>
                <p>Platform activity will appear here as users and stores interact.</p>
              </div>
            ) : (
              <ul className="list" style={{ marginTop: 'var(--space-2)' }}>
                {activity.map((act, idx) => {
                  const config = getActivityConfig(act.type);
                  const Icon = config.icon;
                  return (
                    <li key={idx} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ 
                        width: 36, height: 36, borderRadius: 'var(--radius-full)', 
                        backgroundColor: config.bg, color: config.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Icon size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 'var(--text-md)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {act.description}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                          {getRelativeTime(act.createdAt)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top Stores</h3>
          </div>
          <div className="card-body">
            {topStores.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon">
                  <TrendingUp size={24} />
                </div>
                <h3>No Stores Yet</h3>
                <p>Top performing stores by revenue will be displayed here.</p>
              </div>
            ) : (
              <ul className="list" style={{ marginTop: 'var(--space-2)' }}>
                {topStores.map((store, idx) => (
                  <li key={store._id || idx} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div className="avatar" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {store.logo ? <img src={store.logo} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} /> : <Store size={20} className="text-muted" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.name}</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{store.totalOrders} Orders</div>
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatCurrency(store.totalRevenue)}
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
