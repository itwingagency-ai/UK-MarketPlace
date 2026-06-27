import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Store,
  Settings,
  BarChart3,
  Star,
  Truck,
  Bell,
  FileText,
  LogOut,
  Shield,
  ClipboardList,
  Tag,
  DollarSign,
  MapPin,
  Clock,
} from 'lucide-react';

/* ── Navigation configs per role ────────────────────────────────────── */

const adminNav = [
  {
    label: 'Main',
    items: [
      { to: '/admin/dashboard', icon: LayoutDashboard, text: 'Dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/users', icon: Users, text: 'Users' },
      { to: '/admin/stores', icon: Store, text: 'Stores' },
      { to: '/admin/orders', icon: ShoppingCart, text: 'Orders' },
      { to: '/admin/vendor-applications', icon: ClipboardList, text: 'Vendor Applications' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/reviews', icon: Star, text: 'Reviews' },
      { to: '/admin/notifications', icon: Bell, text: 'Notifications' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/admin/settings', icon: Settings, text: 'Platform Settings' },
      { to: '/admin/commission', icon: DollarSign, text: 'Commission' },
      { to: '/admin/analytics', icon: BarChart3, text: 'Analytics' },
    ],
  },
];

const vendorNav = [
  {
    label: 'Main',
    items: [
      { to: '/vendor/dashboard', icon: LayoutDashboard, text: 'Dashboard' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/vendor/categories', icon: Tag, text: 'Categories' },
      { to: '/vendor/products', icon: Package, text: 'Products' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/vendor/orders', icon: ShoppingCart, text: 'Orders' },
      { to: '/vendor/reviews', icon: Star, text: 'Reviews' },
      { to: '/vendor/analytics', icon: BarChart3, text: 'Analytics' },
      { to: '/vendor/reports', icon: FileText, text: 'Reports' },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/vendor/settings', icon: Settings, text: 'Store Settings' },
      { to: '/vendor/shipping', icon: Truck, text: 'Shipping Methods' },
      { to: '/vendor/operating-hours', icon: Clock, text: 'Operating Hours' },
      { to: '/vendor/location', icon: MapPin, text: 'Location' },
      { to: '/vendor/commission', icon: DollarSign, text: 'Commission' },
    ],
  },
];

export default function Sidebar({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const sections = role === 'admin' ? adminNav : vendorNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <aside className="sidebar" id="main-sidebar">
      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={18} />
        </div>
        <div>
          <div className="sidebar-brand-text">UK Marketplace</div>
          <div className="sidebar-brand-role">
            {role === 'admin' ? 'Admin Portal' : 'Vendor Portal'}
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
                id={`nav-${item.to.replace(/\//g, '-').slice(1)}`}
              >
                <item.icon size={18} />
                <span>{item.text}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer / User ── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          id="logout-btn"
          style={{ width: '100%', marginTop: 'var(--space-2)', justifyContent: 'flex-start' }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
