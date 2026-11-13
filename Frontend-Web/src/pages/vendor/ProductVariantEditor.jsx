import { Plus, Trash2 } from 'lucide-react';

/*
 * Prices are stored in pence as `price` (what the customer pays) and
 * `compareAtPrice` (the crossed-out original). Shopkeepers think in
 * "regular price" plus an optional "sale price", so convert at the edges.
 */
const toPounds = (pence) => (pence === null || pence === undefined ? '' : (Number(pence) / 100).toFixed(2));
const toPence = (pounds) => Math.round(Number(pounds) * 100);

export function toPriceFields(price, compareAtPrice) {
  if (compareAtPrice && Number(compareAtPrice) > Number(price)) {
    return { regularPrice: toPounds(compareAtPrice), salePrice: toPounds(price) };
  }
  return { regularPrice: toPounds(price), salePrice: '' };
}

/** Returns { price, compareAtPrice } in pence, or { error }. */
export function fromPriceFields(regularPrice, salePrice, label = 'Price') {
  if (regularPrice === '' || regularPrice === undefined || Number.isNaN(Number(regularPrice)) || Number(regularPrice) < 0) {
    return { error: `${label}: enter a regular price` };
  }
  const regular = toPence(regularPrice);
  if (salePrice === '' || salePrice === undefined || salePrice === null) {
    return { price: regular, compareAtPrice: null };
  }
  const sale = toPence(salePrice);
  if (Number.isNaN(sale) || sale < 0) return { error: `${label}: sale price is not a valid amount` };
  if (sale >= regular) return { error: `${label}: sale price must be lower than the regular price` };
  return { price: sale, compareAtPrice: regular };
}

export const emptyVariantRow = () => ({ value: '', regularPrice: '', salePrice: '', stock: 0, isActive: true });

/**
 * Map a saved product to editor state. Products from before this editor may
 * use any single attribute key (e.g. "description"), so read whatever is there.
 */
export function variantStateFromProduct(product) {
  const variants = product?.variants || [];
  if (variants.length === 0) return { enabled: false, optionName: 'Size', rows: [], combined: false };

  const firstKeys = Object.keys(variants[0].attributes || {});
  const optionName = product.options?.[0]?.name || firstKeys[0] || 'Size';
  const combined = (product.options?.length || 0) > 1 || variants.some((v) => Object.keys(v.attributes || {}).length > 1);

  const rows = variants.map((v) => {
    const attrs = v.attributes || {};
    const value = combined
      ? Object.values(attrs).join(' / ')
      : attrs[optionName] ?? Object.values(attrs)[0] ?? '';
    return {
      _id: v._id,
      value,
      ...toPriceFields(v.price, v.compareAtPrice),
      stock: v.stock ?? 0,
      originalStock: v.stock ?? 0,
      isActive: v.isActive !== false,
    };
  });
  return { enabled: true, optionName, rows, combined };
}

/** Build the API's `options` + `variants` payload, or { error }. */
export function variantPayload({ optionName, rows }) {
  const name = (optionName || '').trim();
  if (!name) return { error: 'Give your options a name, e.g. Size or Weight' };
  if (/[.$]/.test(name)) return { error: 'Option name cannot contain "." or "$"' };
  if (rows.length === 0) return { error: 'Add at least one option, or turn off sizes/options' };

  const seen = new Set();
  const variants = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const value = row.value.trim();
    const label = value || `Option ${i + 1}`;
    if (!value) return { error: `${label}: enter a name, e.g. Small or 500 g` };
    if (seen.has(value.toLowerCase())) return { error: `"${value}" is listed twice` };
    seen.add(value.toLowerCase());

    const prices = fromPriceFields(row.regularPrice, row.salePrice, label);
    if (prices.error) return prices;
    const stock = Number(row.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: `${label}: stock must be a whole number, 0 or more` };

    const variant = {
      attributes: { [name]: value },
      price: prices.price,
      compareAtPrice: prices.compareAtPrice,
      isActive: row.isActive,
    };
    if (row._id) variant._id = row._id;
    // Leave untouched stock out so the server keeps its live value — an
    // order placed while this form was open must not be undone.
    if (!row._id || String(row.stock) !== String(row.originalStock)) variant.stock = stock;
    variants.push(variant);
  }
  return {
    options: [{ name, values: variants.map((v) => v.attributes[name]) }],
    variants,
  };
}

const cellLabel = { fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginBottom: 4, display: 'block' };
const smallInput = { fontSize: 'var(--text-sm)', height: 34, width: '100%', minWidth: 0, boxSizing: 'border-box' };

export default function ProductVariantEditor({ state, onChange, disabled }) {
  const { enabled, optionName, rows, combined } = state;

  const setRow = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange({ ...state, rows: next });
  };

  return (
    <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...state, enabled: e.target.checked, rows: e.target.checked && rows.length === 0 ? [emptyVariantRow()] : rows })
          }
        />
        This product comes in different sizes or options
      </label>
      <span className="form-help" style={{ display: 'block', marginTop: 4 }}>
        e.g. a cake in Small, Medium and Large — each with its own price and stock.
      </span>

      {enabled && (
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="variant-option-name">Option name</label>
            <input
              id="variant-option-name"
              className="form-input"
              value={optionName}
              disabled={disabled}
              placeholder="e.g. Size, Weight, Pack"
              onChange={(e) => onChange({ ...state, optionName: e.target.value })}
              maxLength={40}
            />
            {combined && (
              <span className="form-help">This product had several option types; they are combined into one list here.</span>
            )}
          </div>

          {rows.map((row, i) => (
            <div
              key={row._id || `new-${i}`}
              style={{
                padding: 'var(--space-3)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                background: row.isActive ? 'var(--gray-50)' : 'var(--gray-100)',
                opacity: row.isActive ? 1 : 0.75,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--space-3)' }}>
                <div>
                  <label style={cellLabel}>{optionName || 'Option'} *</label>
                  <input
                    className="form-input"
                    style={smallInput}
                    value={row.value}
                    placeholder="e.g. Small"
                    maxLength={60}
                    disabled={disabled}
                    onChange={(e) => setRow(i, { value: e.target.value })}
                  />
                </div>
                <div>
                  <label style={cellLabel}>Regular price (£) *</label>
                  <input
                    type="number"
                    className="form-input"
                    style={smallInput}
                    min="0"
                    step="0.01"
                    value={row.regularPrice}
                    disabled={disabled}
                    onWheel={(e) => e.target.blur()}
                    onChange={(e) => setRow(i, { regularPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label style={cellLabel}>Sale price (£)</label>
                  <input
                    type="number"
                    className="form-input"
                    style={smallInput}
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={row.salePrice}
                    disabled={disabled}
                    onWheel={(e) => e.target.blur()}
                    onChange={(e) => setRow(i, { salePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label style={cellLabel}>In stock</label>
                  <input
                    type="number"
                    className="form-input"
                    style={smallInput}
                    min="0"
                    step="1"
                    value={row.stock}
                    disabled={disabled}
                    onWheel={(e) => e.target.blur()}
                    onChange={(e) => setRow(i, { stock: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                <label className="form-checkbox" style={{ fontSize: 'var(--text-sm)' }}>
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    disabled={disabled}
                    onChange={(e) => setRow(i, { isActive: e.target.checked })}
                  />
                  Available to buy
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger-text)' }}
                  disabled={disabled || rows.length === 1}
                  title={rows.length === 1 ? 'A product with options needs at least one' : 'Remove this option'}
                  onClick={() => onChange({ ...state, rows: rows.filter((_, idx) => idx !== i) })}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-start' }}
            disabled={disabled || rows.length >= 50}
            onClick={() => onChange({ ...state, rows: [...rows, emptyVariantRow()] })}
          >
            <Plus size={14} /> Add another {optionName ? optionName.toLowerCase() : 'option'}
          </button>
        </div>
      )}
    </div>
  );
}
