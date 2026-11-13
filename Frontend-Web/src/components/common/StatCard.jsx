import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * <StatCard> — metric card with value, label, trend indicator and optional icon.
 *
 * Props:
 *   label      – string
 *   value      – string | number
 *   trend      – number | null (percentage change, +/-)
 *   trendLabel – string (e.g. "vs last month")
 *   icon       – ReactNode (Lucide icon)
 *   color      – string (accent color for icon bg, default brand purple)
 */
export default function StatCard({ label, value, trend, trendLabel, icon, color = 'var(--color-brand-primary)' }) {
  const trendDir = trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';

  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div>
          <div className="stat-card-label">{label}</div>
          <div className="stat-card-value">{value}</div>
        </div>
        {icon && (
          <div
            className="stat-card-icon"
            style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
          >
            {icon}
          </div>
        )}
      </div>

      {trend !== undefined && trend !== null && (
        <div className="stat-card-trend">
          <span className={`stat-trend-badge ${trendDir}`}>
            {trendDir === 'up' && <TrendingUp size={12} />}
            {trendDir === 'down' && <TrendingDown size={12} />}
            {trendDir === 'flat' && <Minus size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="stat-trend-label">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
