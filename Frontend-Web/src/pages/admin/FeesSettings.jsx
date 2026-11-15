import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Receipt, Save } from 'lucide-react';
import { adminService } from '../../api/adminService';

/**
 * Customer-facing fees (PlatformSettings.fees). Stored in pence; edited in
 * pounds. Each fee is worked out per store order on goods before discounts.
 */
const toPounds = (p) => (p ? (p / 100).toFixed(2) : '');
const toPence = (s) => Math.round(Number(s || 0) * 100);
const hint = { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' };

const fromSettings = (fees = {}) => ({
  serviceEnabled: Boolean(fees.service?.enabled),
  servicePercent: fees.service?.percent ? String(fees.service.percent) : '',
  serviceMin: toPounds(fees.service?.min),
  serviceMax: toPounds(fees.service?.max),
  serviceLabel: fees.service?.label || 'Service fee',
  smallEnabled: Boolean(fees.smallOrder?.enabled),
  smallThreshold: toPounds(fees.smallOrder?.threshold),
  smallAmount: toPounds(fees.smallOrder?.amount),
  bagEnabled: Boolean(fees.bag?.enabled),
  bagAmount: toPounds(fees.bag?.amount),
});

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', fontWeight: 600 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function FeesSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService.getSettings()
      .then((res) => setForm(fromSettings(res?.data?.fees)))
      .catch(() => toast.error('Failed to load fees'));
  }, []);

  if (!form) return null;
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await adminService.updateSettings({
        fees: {
          service: {
            enabled: form.serviceEnabled,
            percent: Number(form.servicePercent || 0),
            min: toPence(form.serviceMin),
            max: toPence(form.serviceMax),
            label: form.serviceLabel.trim() || 'Service fee',
          },
          smallOrder: { enabled: form.smallEnabled, threshold: toPence(form.smallThreshold), amount: toPence(form.smallAmount) },
          bag: { enabled: form.bagEnabled, amount: toPence(form.bagAmount) },
        },
      });
      setForm(fromSettings(res?.data?.fees));
      toast.success('Fees saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save fees');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 800, marginTop: 'var(--space-6)' }}>
      <div className="card-header">
        <h3><Receipt size={18} style={{ display: 'inline', marginRight: 8 }} />Customer fees</h3>
      </div>
      <div className="card-body">
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <p style={{ ...hint, marginTop: 0 }}>
            Shown to customers as separate lines on each store's order. Worked out on goods before discounts, so a coupon never changes a fee.
          </p>

          <div>
            <Toggle checked={form.serviceEnabled} onChange={(v) => set('serviceEnabled', v)} label="Service fee (platform revenue)" />
            {form.serviceEnabled ? (
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Percentage of goods (%)</label>
                  <input type="number" className="form-input" min="0" max="20" step="0.1" value={form.servicePercent} onChange={(e) => set('servicePercent', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input className="form-input" maxLength={60} value={form.serviceLabel} onChange={(e) => set('serviceLabel', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Minimum (£)</label>
                  <input type="number" className="form-input" min="0" step="0.01" value={form.serviceMin} onChange={(e) => set('serviceMin', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Maximum (£)</label>
                  <input type="number" className="form-input" min="0" step="0.01" value={form.serviceMax} onChange={(e) => set('serviceMax', e.target.value)} />
                  <p style={hint}>Empty = no cap</p>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <Toggle checked={form.smallEnabled} onChange={(v) => set('smallEnabled', v)} label="Small order fee (platform revenue)" />
            {form.smallEnabled ? (
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Charge on orders under (£)</label>
                  <input type="number" className="form-input" min="0.01" step="0.01" value={form.smallThreshold} onChange={(e) => set('smallThreshold', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Fee (£)</label>
                  <input type="number" className="form-input" min="0.01" step="0.01" value={form.smallAmount} onChange={(e) => set('smallAmount', e.target.value)} required />
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <Toggle checked={form.bagEnabled} onChange={(v) => set('bagEnabled', v)} label="Carrier bag charge (kept by the store)" />
            {form.bagEnabled ? (
              <div className="form-group" style={{ marginTop: 'var(--space-3)', maxWidth: 260 }}>
                <label className="form-label">Charge per order (£)</label>
                <input type="number" className="form-input" min="0.01" step="0.01" value={form.bagAmount} onChange={(e) => set('bagAmount', e.target.value)} required />
                <p style={hint}>Customers can switch it off if they don't need bags.</p>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save fees'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
