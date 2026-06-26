import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bell, Search } from 'lucide-react';

/* ── Breadcrumb builder from pathname ────────────────────────────────── */
function buildBreadcrumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.map((part) =>
    part
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function TopHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const crumbs = buildBreadcrumbs(location.pathname);

  return (
    <header className="top-header" id="top-header">
      <div className="top-header-left">
        <div className="top-header-breadcrumb">
          {crumbs.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span style={{ margin: '0 4px', color: 'var(--gray-300)' }}>/</span>}
              <span style={i === crumbs.length - 1 ? { color: 'var(--color-text)', fontWeight: 500 } : {}}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="top-header-right">
        <button className="btn btn-icon btn-ghost" data-tooltip="Search" id="header-search-btn">
          <Search size={18} />
        </button>
        <button className="btn btn-icon btn-ghost" data-tooltip="Notifications" id="header-notifications-btn">
          <Bell size={18} />
        </button>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--primary-400), var(--primary-600))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
          }}
          data-tooltip={user?.name || 'User'}
        >
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
      </div>
    </header>
  );
}
