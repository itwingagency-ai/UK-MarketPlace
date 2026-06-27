/**
 * <FilterBar> — composable filter dropdowns and text inputs.
 *
 * Props:
 *   filters  – [{ key, label, type: 'select'|'text'|'date', options?: [{value, label}], placeholder? }]
 *   values   – { [key]: value }
 *   onChange – (key, value) => void
 *   onReset  – () => void
 */
export default function FilterBar({ filters = [], values = {}, onChange, onReset }) {
  const hasActiveFilters = filters.some((f) => {
    const v = values[f.key];
    return v !== undefined && v !== '' && v !== null;
  });

  return (
    <div className="filter-bar">
      <div className="filter-bar-fields">
        {filters.map((f) => (
          <div key={f.key} className="filter-bar-field">
            <label className="filter-bar-label">{f.label}</label>
            {f.type === 'select' ? (
              <select
                className="form-select"
                value={values[f.key] || ''}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                id={`filter-${f.key}`}
              >
                <option value="">All</option>
                {(f.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'date' ? (
              <input
                type="date"
                className="form-input"
                value={values[f.key] || ''}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                id={`filter-${f.key}`}
              />
            ) : (
              <input
                type="text"
                className="form-input"
                placeholder={f.placeholder || ''}
                value={values[f.key] || ''}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                id={`filter-${f.key}`}
              />
            )}
          </div>
        ))}
      </div>

      {hasActiveFilters && onReset && (
        <button className="btn btn-ghost btn-sm" onClick={onReset} id="filter-reset-btn">
          Clear Filters
        </button>
      )}
    </div>
  );
}
