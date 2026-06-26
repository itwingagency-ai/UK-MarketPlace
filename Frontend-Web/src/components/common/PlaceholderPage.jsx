import { Construction } from 'lucide-react';

/**
 * PlaceholderPage — used for routes that are planned but not yet built.
 */
export default function PlaceholderPage({ title, description, phase }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page-icon">
        <Construction size={36} />
      </div>
      <h2>{title || 'Coming Soon'}</h2>
      <p>{description || 'This module is under development.'}</p>
      {phase && (
        <span
          className="badge badge-primary"
          style={{ marginTop: 'var(--space-3)' }}
        >
          Planned for Phase {phase}
        </span>
      )}
    </div>
  );
}
