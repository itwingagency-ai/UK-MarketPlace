/**
 * <PageHeader> — title, breadcrumbs, and action buttons.
 *
 * Props:
 *   title       – string
 *   subtitle    – string (optional)
 *   breadcrumbs – [{ label, to? }]  (optional)
 *   actions     – ReactNode (right-aligned buttons)
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PageHeader({ title, subtitle, breadcrumbs, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-info">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" id="page-breadcrumbs">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="breadcrumb-item">
                {i > 0 && <ChevronRight size={12} className="breadcrumb-sep" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="breadcrumb-link">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="breadcrumb-current">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
