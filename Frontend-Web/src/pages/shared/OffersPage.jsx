import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Ticket, Sparkles, Receipt, AlertTriangle } from 'lucide-react';
import { PageHeader, Modal, StatusBadge, Skeleton } from '../../components/common';
import { formatCurrency, formatDate } from '../../utils/formatters';

/**
 * Coupons, automatic offers and the redemption report.
 * Used by /vendor/offers (own store, always vendor-funded) and /admin/offers
 * (platform-wide, or sponsoring a store). The API works in pence; forms take
 * pounds and convert. Every discount a customer sees is computed by the server.
 */

const toPence = (pounds) => (pounds === '' || pounds === null || pounds === undefined ? null : Math.round(Number(pounds) * 100));
const toPounds = (pence) => (pence === null || pence === undefined ? '' : (Number(pence) / 100).toFixed(2));
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fromDateInput = (s, endOfDay = false) => (s ? new Date(`${s}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString() : null);
const apiMessage = (err, fallback) => err?.response?.data?.message || fallback;

const isLive = (doc) => {
  const now = Date.now();
  if (!doc.isActive) return 'inactive';
  if (doc.startsAt && new Date(doc.startsAt).getTime() > now) return 'scheduled';
  if (doc.endsAt && new Date(doc.endsAt).getTime() <= now) return 'expired';
  return 'active';
};

const couponSummary = (c) => {
  if (c.type === 'free_delivery') return 'Free delivery';
  if (c.type === 'percent') return `${c.value}% off${c.maxDiscount ? ` (max ${formatCurrency(c.maxDiscount)})` : ''}`;
  return `${formatCurrency(c.value)} off`;
};

const promotionSummary = (p) => {
  if (p.type === 'multibuy') return `Buy ${p.buyQuantity}, get ${p.getQuantity} free`;
  const reward = p.discountType === 'percent' ? `${p.discountValue}% off` : `${formatCurrency(p.discountValue)} off`;
  return `Spend ${formatCurrency(p.minSubtotal)}, ${reward}`;
};

const hint = { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' };

function Field({ label, help, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {help ? <p style={hint}>{help}</p> : null}
    </div>
  );
}

function ConfirmDelete({ target, onCancel, onConfirm, busy, what }) {
  return (
    <Modal
      open={Boolean(target)}
      onClose={onCancel}
      title={`Delete ${what}`}
      size="sm"
      footer={
        <div className="flex justify-end" style={{ gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
        <p>
          Delete <strong>{target?.label}</strong>? {what === 'coupon'
            ? 'If it has been used it is switched off instead, so past orders and reports stay intact.'
            : 'Orders that already used it keep their discount.'}
        </p>
      </div>
    </Modal>
  );
}

/* ── Admin: scope / store / funding picker ──────────────────────────── */

function ScopePicker({ form, set, stores, noun }) {
  return (
    <>
      <Field label="Applies to">
        <select className="form-select" value={form.scope} onChange={(e) => set('scope', e.target.value)}>
          <option value="platform">Every store (marketplace {noun})</option>
          <option value="store">One store</option>
        </select>
      </Field>
      {form.scope === 'store' ? (
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <Field label="Store">
            <select className="form-select" value={form.store} onChange={(e) => set('store', e.target.value)} required>
              <option value="">Choose a store</option>
              {stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Who pays for the discount" help="Platform: the store is paid as if full price was charged.">
            <select className="form-select" value={form.fundedBy} onChange={(e) => set('fundedBy', e.target.value)}>
              <option value="platform">Platform</option>
              <option value="vendor">The store</option>
            </select>
          </Field>
        </div>
      ) : (
        <p style={hint}>Marketplace {noun}s are always paid for by the platform.</p>
      )}
    </>
  );
}

/* ── Coupons ─────────────────────────────────────────────────────────── */

const EMPTY_COUPON = {
  id: null, code: '', description: '', type: 'percent', value: '', maxDiscount: '', minSubtotal: '',
  startsAt: '', endsAt: '', usageLimit: '', perUserLimit: '1', firstOrderOnly: false, isActive: true,
  scope: 'platform', store: '', fundedBy: 'platform', used: false,
};

function CouponsTab({ service, isAdmin, stores }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await service.getCoupons();
      setCoupons(res?.data || []);
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to load coupons'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openEdit = (c) =>
    setForm({
      id: c._id,
      code: c.code,
      description: c.description || '',
      type: c.type,
      value: c.type === 'fixed' ? toPounds(c.value) : c.type === 'percent' ? String(c.value) : '',
      maxDiscount: toPounds(c.maxDiscount),
      minSubtotal: c.minSubtotal ? toPounds(c.minSubtotal) : '',
      startsAt: toDateInput(c.startsAt),
      endsAt: toDateInput(c.endsAt),
      usageLimit: c.usageLimit ? String(c.usageLimit) : '',
      perUserLimit: String(c.perUserLimit || 1),
      firstOrderOnly: Boolean(c.firstOrderOnly),
      isActive: c.isActive !== false,
      scope: c.scope,
      store: c.store?._id || c.store || '',
      fundedBy: c.fundedBy,
      used: c.uses > 0,
    });

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      value: form.type === 'percent' ? Number(form.value) : form.type === 'fixed' ? toPence(form.value) : 0,
      maxDiscount: form.type === 'percent' ? toPence(form.maxDiscount) : null,
      minSubtotal: toPence(form.minSubtotal) || 0,
      startsAt: fromDateInput(form.startsAt),
      endsAt: fromDateInput(form.endsAt, true),
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: Number(form.perUserLimit || 1),
      firstOrderOnly: form.firstOrderOnly,
      isActive: form.isActive,
    };
    if (isAdmin) {
      payload.scope = form.scope;
      if (form.scope === 'store') {
        payload.store = form.store;
        payload.fundedBy = form.fundedBy;
      }
    }
    if (form.used) {
      // Identity is locked once used; only send what may still change
      for (const k of ['code', 'type', 'scope', 'store', 'fundedBy']) delete payload[k];
      if (form.type !== 'percent') delete payload.maxDiscount;
    }
    try {
      setSaving(true);
      if (form.id) await service.updateCoupon(form.id, payload);
      else await service.createCoupon(payload);
      toast.success(form.id ? 'Coupon updated' : 'Coupon created');
      setForm(null);
      load();
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to save coupon'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      setDeleting(true);
      const res = await service.deleteCoupon(toDelete.id);
      toast.success(res?.message || 'Coupon deleted');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to delete coupon'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading && coupons.length === 0) return <div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={4} /></div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-4)' }}>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY_COUPON, scope: isAdmin ? 'platform' : 'store', fundedBy: isAdmin ? 'platform' : 'vendor' })} id="add-coupon-btn">
          <Plus size={18} /> New coupon
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
          <div className="empty-state-icon"><Ticket size={32} /></div>
          <h3>No coupons yet</h3>
          <p>Create a code customers can type at the basket.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                {isAdmin ? <th>Applies to</th> : null}
                <th>Paid by</th>
                <th>Uses</th>
                <th>Discount given</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong style={{ letterSpacing: '0.04em' }}>{c.code}</strong>
                    {c.description ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{c.description}</div> : null}
                  </td>
                  <td>
                    {couponSummary(c)}
                    {c.minSubtotal ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Min spend {formatCurrency(c.minSubtotal)}</div> : null}
                    {c.firstOrderOnly ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>First order only</div> : null}
                  </td>
                  {isAdmin ? <td>{c.scope === 'platform' ? 'Every store' : c.store?.name || 'One store'}</td> : null}
                  <td>{c.fundedBy === 'platform' ? 'Platform' : 'Store'}</td>
                  <td>{c.uses}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td>{formatCurrency(c.discountTotal)}</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {c.startsAt ? formatDate(c.startsAt) : 'Now'} – {c.endsAt ? formatDate(c.endsAt) : 'No end'}
                  </td>
                  <td><StatusBadge status={isLive(c) === 'scheduled' ? 'pending' : isLive(c)} label={isLive(c)} size="sm" /></td>
                  <td className="text-right">
                    <div className="flex justify-end" style={{ gap: '0.375rem' }}>
                      <button className="btn btn-icon" onClick={() => openEdit(c)} title="Edit"><Edit2 size={15} /></button>
                      <button className="btn btn-icon text-danger" onClick={() => setToDelete({ id: c._id, label: c.code })} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? `Edit ${form.code}` : 'New coupon'}
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button type="submit" form="coupon-form" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save coupon'}</button>
          </div>
        }
      >
        {form ? (
          <form id="coupon-form" onSubmit={submit} className="space-y-4">
            {form.used ? <p style={{ ...hint, marginTop: 0 }}>This coupon has been used, so its code, type and who pays for it are fixed.</p> : null}
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <Field label="Code" help="Letters, numbers, - or _">
                <input className="form-input" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} pattern="[A-Za-z0-9_-]{3,30}" required disabled={form.used} />
              </Field>
              <Field label="Type">
                <select className="form-select" value={form.type} onChange={(e) => set('type', e.target.value)} disabled={form.used}>
                  <option value="percent">Percentage off</option>
                  <option value="fixed">Amount off</option>
                  <option value="free_delivery">Free delivery</option>
                </select>
              </Field>
            </div>
            {form.type !== 'free_delivery' ? (
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <Field label={form.type === 'percent' ? 'Percentage (%)' : 'Amount off (£)'}>
                  <input type="number" className="form-input" min={form.type === 'percent' ? 1 : 0.01} max={form.type === 'percent' ? 100 : undefined} step={form.type === 'percent' ? 1 : 0.01} value={form.value} onChange={(e) => set('value', e.target.value)} required />
                </Field>
                {form.type === 'percent' ? (
                  <Field label="Maximum discount (£)" help="Optional cap">
                    <input type="number" className="form-input" min="0" step="0.01" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
                  </Field>
                ) : <div />}
              </div>
            ) : null}
            <Field label="Description" help="Shown to customers under the discount">
              <input className="form-input" maxLength={200} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <Field label="Minimum spend (£)" help={isAdmin && form.scope === 'platform' ? 'Across the whole basket' : 'With this store'}>
                <input type="number" className="form-input" min="0" step="0.01" value={form.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} />
              </Field>
              <Field label="Total uses" help="Empty = unlimited">
                <input type="number" className="form-input" min="1" step="1" value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <Field label="Starts">
                <input type="date" className="form-input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
              </Field>
              <Field label="Ends">
                <input type="date" className="form-input" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
              </Field>
            </div>
            <Field label="Uses per customer">
              <input type="number" className="form-input" min="1" max="1000" step="1" value={form.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} required />
            </Field>
            {isAdmin && !form.used ? <ScopePicker form={form} set={set} stores={stores} noun="code" /> : null}
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => set('firstOrderOnly', e.target.checked)} />
              <span>Customer's first order only</span>
            </label>
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              <span>Active</span>
            </label>
          </form>
        ) : null}
      </Modal>

      <ConfirmDelete target={toDelete} what="coupon" busy={deleting} onCancel={() => setToDelete(null)} onConfirm={remove} />
    </>
  );
}

/* ── Automatic offers ────────────────────────────────────────────────── */

const EMPTY_PROMO = {
  id: null, name: '', type: 'spend_and_save', minSubtotal: '', discountType: 'fixed', discountValue: '',
  maxDiscount: '', buyQuantity: '2', getQuantity: '1', products: [], startsAt: '', endsAt: '', isActive: true,
  scope: 'platform', store: '', fundedBy: 'platform',
};

function PromotionsTab({ service, isAdmin, stores, products }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await service.getPromotions();
      setPromos(res?.data || []);
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to load offers'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleProduct = (id) =>
    setForm((prev) => ({ ...prev, products: prev.products.includes(id) ? prev.products.filter((p) => p !== id) : [...prev.products, id] }));

  const openEdit = (p) =>
    setForm({
      id: p._id,
      name: p.name,
      type: p.type,
      minSubtotal: p.minSubtotal ? toPounds(p.minSubtotal) : '',
      discountType: p.discountType || 'fixed',
      discountValue: p.discountType === 'percent' ? String(p.discountValue) : toPounds(p.discountValue),
      maxDiscount: toPounds(p.maxDiscount),
      buyQuantity: String(p.buyQuantity || 2),
      getQuantity: String(p.getQuantity || 1),
      products: (p.products || []).map((x) => x._id || x),
      startsAt: toDateInput(p.startsAt),
      endsAt: toDateInput(p.endsAt),
      isActive: p.isActive !== false,
      scope: p.scope,
      store: p.store?._id || p.store || '',
      fundedBy: p.fundedBy,
    });

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      type: form.type,
      products: form.products,
      startsAt: fromDateInput(form.startsAt),
      endsAt: fromDateInput(form.endsAt, true),
      isActive: form.isActive,
    };
    if (form.type === 'spend_and_save') {
      payload.minSubtotal = toPence(form.minSubtotal) || 0;
      payload.discountType = form.discountType;
      payload.discountValue = form.discountType === 'percent' ? Number(form.discountValue) : toPence(form.discountValue);
      payload.maxDiscount = form.discountType === 'percent' ? toPence(form.maxDiscount) : null;
    } else {
      payload.buyQuantity = Number(form.buyQuantity);
      payload.getQuantity = Number(form.getQuantity);
    }
    if (isAdmin) {
      payload.scope = form.scope;
      if (form.scope === 'store') {
        payload.store = form.store;
        payload.fundedBy = form.fundedBy;
      }
    }
    try {
      setSaving(true);
      if (form.id) await service.updatePromotion(form.id, payload);
      else await service.createPromotion(payload);
      toast.success(form.id ? 'Offer updated' : 'Offer created');
      setForm(null);
      load();
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to save offer'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      setDeleting(true);
      await service.deletePromotion(toDelete.id);
      toast.success('Offer deleted');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to delete offer'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading && promos.length === 0) return <div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={4} /></div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', gap: 'var(--space-4)' }}>
        <p style={{ ...hint, marginTop: 0 }}>Offers apply automatically, no code needed. If several match an order, only the best one for the customer applies.</p>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY_PROMO, scope: isAdmin ? 'platform' : 'store', fundedBy: isAdmin ? 'platform' : 'vendor' })} id="add-offer-btn">
          <Plus size={18} /> New offer
        </button>
      </div>

      {promos.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
          <div className="empty-state-icon"><Sparkles size={32} /></div>
          <h3>No automatic offers</h3>
          <p>Try "Spend £20, save £3" or "3 for 2".</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Offer</th>
                <th>Rule</th>
                {isAdmin ? <th>Applies to</th> : null}
                <th>Products</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{promotionSummary(p)}</td>
                  {isAdmin ? <td>{p.scope === 'platform' ? 'Every store' : p.store?.name || 'One store'}</td> : null}
                  <td style={{ fontSize: 'var(--text-sm)' }}>{p.products?.length ? p.products.map((x) => x.title).join(', ') : 'Everything'}</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {p.startsAt ? formatDate(p.startsAt) : 'Now'} – {p.endsAt ? formatDate(p.endsAt) : 'No end'}
                  </td>
                  <td><StatusBadge status={isLive(p) === 'scheduled' ? 'pending' : isLive(p)} label={isLive(p)} size="sm" /></td>
                  <td className="text-right">
                    <div className="flex justify-end" style={{ gap: '0.375rem' }}>
                      <button className="btn btn-icon" onClick={() => openEdit(p)} title="Edit"><Edit2 size={15} /></button>
                      <button className="btn btn-icon text-danger" onClick={() => setToDelete({ id: p._id, label: p.name })} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit offer' : 'New offer'}
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button type="submit" form="offer-form" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save offer'}</button>
          </div>
        }
      >
        {form ? (
          <form id="offer-form" onSubmit={submit} className="space-y-4">
            <Field label="Name" help="Customers see this on their basket">
              <input className="form-input" minLength={2} maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Spend £20, save £3" />
            </Field>
            <Field label="Type">
              <select className="form-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="spend_and_save">Spend and save</option>
                <option value="multibuy">Multibuy (cheapest free)</option>
              </select>
            </Field>
            {form.type === 'spend_and_save' ? (
              <>
                <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                  <Field label="Spend at least (£)">
                    <input type="number" className="form-input" min="0.01" step="0.01" value={form.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} required />
                  </Field>
                  <Field label="Reward">
                    <select className="form-select" value={form.discountType} onChange={(e) => set('discountType', e.target.value)}>
                      <option value="fixed">Amount off</option>
                      <option value="percent">Percentage off</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                  <Field label={form.discountType === 'percent' ? 'Percentage (%)' : 'Amount off (£)'}>
                    <input type="number" className="form-input" min={form.discountType === 'percent' ? 1 : 0.01} max={form.discountType === 'percent' ? 100 : undefined} step={form.discountType === 'percent' ? 1 : 0.01} value={form.discountValue} onChange={(e) => set('discountValue', e.target.value)} required />
                  </Field>
                  {form.discountType === 'percent' ? (
                    <Field label="Maximum discount (£)" help="Optional cap">
                      <input type="number" className="form-input" min="0" step="0.01" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
                    </Field>
                  ) : <div />}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <Field label="Buy">
                  <input type="number" className="form-input" min="1" max="50" step="1" value={form.buyQuantity} onChange={(e) => set('buyQuantity', e.target.value)} required />
                </Field>
                <Field label="Get free" help={`"3 for 2" is buy 2, get 1`}>
                  <input type="number" className="form-input" min="1" max="50" step="1" value={form.getQuantity} onChange={(e) => set('getQuantity', e.target.value)} required />
                </Field>
              </div>
            )}
            {products.length > 0 ? (
              <Field label="Products" help="Leave all unticked to include everything in the store">
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                  {products.map((p) => (
                    <label key={p._id} className="flex items-center cursor-pointer" style={{ gap: '0.5rem', padding: '0.25rem' }}>
                      <input type="checkbox" checked={form.products.includes(p._id)} onChange={() => toggleProduct(p._id)} />
                      <span>{p.title}</span>
                    </label>
                  ))}
                </div>
              </Field>
            ) : null}
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <Field label="Starts">
                <input type="date" className="form-input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
              </Field>
              <Field label="Ends">
                <input type="date" className="form-input" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
              </Field>
            </div>
            {isAdmin && !form.id ? <ScopePicker form={form} set={set} stores={stores} noun="offer" /> : null}
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              <span>Active</span>
            </label>
          </form>
        ) : null}
      </Modal>

      <ConfirmDelete target={toDelete} what="offer" busy={deleting} onCancel={() => setToDelete(null)} onConfirm={remove} />
    </>
  );
}

/* ── Redemption report ───────────────────────────────────────────────── */

function RedemptionsTab({ service, isAdmin }) {
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    service.getCouponRedemptions({ status, page, limit: 25 })
      .then((res) => { if (alive) setReport(res); })
      .catch((err) => toast.error(apiMessage(err, 'Failed to load redemptions')))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status, page]);

  const rows = report?.data || [];
  const pages = report ? Math.max(1, Math.ceil(report.total / report.limit)) : 1;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="tablist">
          {[['active', 'Used'], ['released', 'Given back (cancelled orders)']].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={status === key} className={`btn btn-sm ${status === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setStatus(key); setPage(1); }}>
              {label}
            </button>
          ))}
        </div>
        {report ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Total <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(report.totals.amount)}</strong>
            {' · '}paid by platform {formatCurrency(report.totals.platform.amount)}
            {' · '}paid by {isAdmin ? 'stores' : 'you'} {formatCurrency(report.totals.vendor.amount)}
          </div>
        ) : null}
      </div>
      {loading && !report ? (
        <div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={4} /></div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
          <div className="empty-state-icon"><Receipt size={32} /></div>
          <h3>Nothing here yet</h3>
          <p>Each order that used a coupon shows up here.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Code</th>
                <th>Order</th>
                {isAdmin ? <th>Store</th> : null}
                <th>Customer</th>
                <th>Paid by</th>
                <th className="text-right">Discount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{formatDate(r.createdAt)}</td>
                  <td><strong>{r.code}</strong></td>
                  <td>{r.order?.orderNumber || '—'}</td>
                  {isAdmin ? <td>{r.store?.name || '—'}</td> : null}
                  <td>{r.user?.name || '—'}{isAdmin && r.user?.email ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.user.email}</div> : null}</td>
                  <td>{r.fundedBy === 'platform' ? 'Platform' : 'Store'}</td>
                  <td className="text-right">{formatCurrency(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="flex justify-end" style={{ gap: '0.5rem', padding: 'var(--space-4)' }}>
          <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>Page {page} of {pages}</span>
          <button className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}
    </>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

const TABS = [
  ['coupons', 'Coupons'],
  ['offers', 'Automatic offers'],
  ['redemptions', 'Redemptions'],
];

export default function OffersPage({ role, service, loadStores, loadProducts }) {
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState('coupons');
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (loadStores) loadStores().then(setStores).catch(() => setStores([]));
    if (loadProducts) loadProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  const base = isAdmin ? '/admin' : '/vendor';
  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Coupons & Offers"
        subtitle={isAdmin
          ? 'Marketplace codes and offers, store sponsorships and what they cost.'
          : 'Codes and automatic offers for your store. Discounts you create are paid by your store.'}
        breadcrumbs={[{ label: 'Dashboard', to: `${base}/dashboard` }, { label: 'Coupons & Offers' }]}
      />
      <div className="card">
        <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)', background: 'var(--gray-50)' }} role="tablist">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'coupons' ? <CouponsTab service={service} isAdmin={isAdmin} stores={stores} /> : null}
        {tab === 'offers' ? <PromotionsTab service={service} isAdmin={isAdmin} stores={stores} products={isAdmin ? [] : products} /> : null}
        {tab === 'redemptions' ? <RedemptionsTab service={service} isAdmin={isAdmin} /> : null}
      </div>
    </div>
  );
}
