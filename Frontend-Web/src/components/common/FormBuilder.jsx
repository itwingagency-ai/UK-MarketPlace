import { useState, useEffect } from 'react';

/**
 * <FormBuilder> — renders a form from a field definition array.
 *
 * Props:
 *   fields       – [{ key or name, label, type, placeholder?, required?, options?, rows?, disabled?, helpText? }]
 *   values       – { [key]: value } (Controlled mode)
 *   initialValues- { [key]: value } (Uncontrolled mode)
 *   onChange     – (key, value) => void (Controlled mode)
 *   onSubmit     – (values) => void
 *   submitting   – boolean
 *   submitLabel  – string (default 'Save')
 *   cancelLabel  – string (default 'Cancel')
 *   onCancel     – () => void
 *   errors       – { [key]: string }  (field-level errors)
 */
export default function FormBuilder({
  fields = [],
  values,
  initialValues = {},
  onChange,
  onSubmit,
  submitting = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  errors = {},
  children,
}) {
  const [localErrors, setLocalErrors] = useState({});
  const [localValues, setLocalValues] = useState(initialValues);

  // Sync internal state if initialValues changes (e.g. opening different edit item)
  useEffect(() => {
    setLocalValues(initialValues);
  }, [initialValues]);

  const isControlled = values !== undefined;
  const currentValues = isControlled ? values : localValues;

  const handleChange = (fieldKey, val) => {
    if (isControlled) {
      onChange?.(fieldKey, val);
    } else {
      setLocalValues((prev) => ({ ...prev, [fieldKey]: val }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic required validation
    const errs = {};
    fields.forEach((f) => {
      const fieldKey = f.key || f.name;
      if (f.required) {
        const val = currentValues[fieldKey];
        if (val === undefined || val === null || val.toString().trim() === '') {
          errs[fieldKey] = `${f.label} is required`;
        }
      }
    });
    setLocalErrors(errs);

    if (Object.keys(errs).length > 0) return;
    onSubmit?.(currentValues);
  };

  const allErrors = { ...localErrors, ...errors };

  const renderField = (f) => {
    const fieldKey = f.key || f.name;
    const val = currentValues[fieldKey] ?? '';
    const err = allErrors[fieldKey];
    const fieldId = `form-field-${fieldKey}`;

    switch (f.type) {
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            className={`form-input${err ? ' form-input-error' : ''}`}
            value={val}
            onChange={(e) => handleChange(fieldKey, e.target.value)}
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
            onChange={(e) => handleChange(fieldKey, e.target.value)}
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

      case 'switch':
      case 'checkbox':
        return (
          <label className="form-checkbox" style={{ marginTop: 'var(--space-1)' }}>
            <input
              id={fieldId}
              type="checkbox"
              checked={!!val}
              onChange={(e) => handleChange(fieldKey, e.target.checked)}
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
            onChange={(e) => handleChange(fieldKey, e.target.value)}
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
            onChange={(e) => handleChange(fieldKey, e.target.value)}
            placeholder={f.placeholder || ''}
            disabled={f.disabled || submitting}
          />
        );
    }
  };

  return (
    <form className="form-builder" onSubmit={handleSubmit}>
      {fields.map((f) => {
        const fieldKey = f.key || f.name;
        return (
          <div key={fieldKey} className="form-group">
            {f.type !== 'checkbox' && f.type !== 'switch' && (
              <label className="form-label" htmlFor={`form-field-${fieldKey}`}>
                {f.label}
                {f.required && <span className="form-required">*</span>}
              </label>
            )}
            {renderField(f)}
            {f.helpText && <span className="form-help">{f.helpText}</span>}
            {allErrors[fieldKey] && <span className="form-error">{allErrors[fieldKey]}</span>}
          </div>
        );
      })}

      {children}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff', marginRight: 8, display: 'inline-block', borderRadius: '50%' }} />
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
