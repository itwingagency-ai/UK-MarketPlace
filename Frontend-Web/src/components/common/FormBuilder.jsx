import { useState } from 'react';

/**
 * <FormBuilder> — renders a form from a field definition array.
 *
 * Props:
 *   fields       – [{ key, label, type, placeholder?, required?, options?, rows?, disabled?, helpText? }]
 *   values       – { [key]: value }
 *   onChange     – (key, value) => void
 *   onSubmit     – (values) => void
 *   submitting   – boolean
 *   submitLabel  – string (default 'Save')
 *   cancelLabel  – string (default 'Cancel')
 *   onCancel     – () => void
 *   errors       – { [key]: string }  (field-level errors)
 */
export default function FormBuilder({
  fields = [],
  values = {},
  onChange,
  onSubmit,
  submitting = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  errors = {},
}) {
  const [localErrors, setLocalErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic required validation
    const errs = {};
    fields.forEach((f) => {
      if (f.required && !values[f.key]?.toString().trim()) {
        errs[f.key] = `${f.label} is required`;
      }
    });
    setLocalErrors(errs);

    if (Object.keys(errs).length > 0) return;
    onSubmit?.(values);
  };

  const allErrors = { ...localErrors, ...errors };

  const renderField = (f) => {
    const val = values[f.key] ?? '';
    const err = allErrors[f.key];
    const fieldId = `form-field-${f.key}`;

    switch (f.type) {
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            className={`form-input${err ? ' form-input-error' : ''}`}
            value={val}
            onChange={(e) => onChange?.(f.key, e.target.value)}
            placeholder={f.placeholder || ''}
            rows={f.rows || 3}
            disabled={f.disabled || submitting}
            style={{ resize: 'vertical' }}
          />
        );

      case 'select':
        return (
          <select
            id={fieldId}
            className={`form-select${err ? ' form-input-error' : ''}`}
            value={val}
            onChange={(e) => onChange?.(f.key, e.target.value)}
            disabled={f.disabled || submitting}
          >
            <option value="">{f.placeholder || 'Select…'}</option>
            {(f.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="form-checkbox" style={{ marginTop: 'var(--space-1)' }}>
            <input
              id={fieldId}
              type="checkbox"
              checked={!!val}
              onChange={(e) => onChange?.(f.key, e.target.checked)}
              disabled={f.disabled || submitting}
            />
            {f.placeholder || f.label}
          </label>
        );

      case 'number':
        return (
          <input
            id={fieldId}
            className={`form-input${err ? ' form-input-error' : ''}`}
            type="number"
            value={val}
            onChange={(e) => onChange?.(f.key, e.target.value)}
            placeholder={f.placeholder || ''}
            disabled={f.disabled || submitting}
            min={f.min}
            max={f.max}
            step={f.step}
          />
        );

      default:
        return (
          <input
            id={fieldId}
            className={`form-input${err ? ' form-input-error' : ''}`}
            type={f.type || 'text'}
            value={val}
            onChange={(e) => onChange?.(f.key, e.target.value)}
            placeholder={f.placeholder || ''}
            disabled={f.disabled || submitting}
          />
        );
    }
  };

  return (
    <form className="form-builder" onSubmit={handleSubmit}>
      {fields.map((f) => (
        <div key={f.key} className="form-group">
          {f.type !== 'checkbox' && (
            <label className="form-label" htmlFor={`form-field-${f.key}`}>
              {f.label}
              {f.required && <span className="form-required">*</span>}
            </label>
          )}
          {renderField(f)}
          {f.helpText && <span className="form-help">{f.helpText}</span>}
          {allErrors[f.key] && <span className="form-error">{allErrors[f.key]}</span>}
        </div>
      ))}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
