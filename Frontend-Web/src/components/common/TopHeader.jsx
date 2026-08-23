import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu } from 'lucide-react';

/* ── Breadcrumb builder from pathname ────────────────────────────────── */
function buildBreadcrumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.map((part) =>
    part
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function TopHeader({ onMenuClick }) {
  const { user } = useAuth();
  const location = useLocation();
  const crumbs = buildBreadcrumbs(location.pathname);

  return (
    <header className="top-header" id="top-header">
      <div className="top-header-left">
        <button className="btn btn-icon btn-ghost mobile-menu-btn" onClick={onMenuClick}>
          <Menu size={18} />
        </button>
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
      </div>
    </header>
  );
}
