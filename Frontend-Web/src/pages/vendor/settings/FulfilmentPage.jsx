import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save, Truck, Store as StoreIcon, CalendarClock, AlertCircle } from 'lucide-react';
import { vendorService } from '../../../api/vendorService';
import { PageHeader, Skeleton } from '../../../components/common';

/**
 * How the store hands orders over: delivery, click & collect, and bookable
 * time slots. Slots are cut from the store's opening hours, so they need
 * Operating Hours to be set.
 */
const hint = { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' };

export default function FulfilmentPage() {
  const [form, setForm] = useState(null);
  const [meta, setMeta] = useState({ hasHours: true, timezone: 'UTC' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    vendorService.getFulfilment()
      .then((res) => {
        const d = res?.data || {};
        setMeta({ hasHours: d.hasHours, timezone: d.timezone });
        setForm({
          deliveryEnabled: d.deliveryEnabled !== false,
          collectionEnabled: Boolean(d.collectionEnabled),
          collectionInstructions: d.collectionInstructions || '',
          scheduling: d.daysAhead > 0,
          daysAhead: String(d.daysAhead > 0 ? d.daysAhead : 3),
          slotLengthMins: String(d.slotLengthMins || 60),
          leadTimeMins: String(d.leadTimeMins ?? 60),
          maxOrdersPerSlot: d.maxOrdersPerSlot ? String(d.maxOrdersPerSlot) : '',
        });
      })
      .catch(() => toast.error('Failed to load fulfilment settings'));
  }, []);

  if (!form) {
    return (
      <div className="animate-slide-up">
        <PageHeader title="Delivery & Collection" />
        <div className="card"><div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={5} /></div></div>
      </div>
    );
  }

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.deliveryEnabled && !form.collectionEnabled) {
      toast.error('Offer at least one of delivery or collection');
      return;
    }
    try {
      setSaving(true);
      await vendorService.updateFulfilment({
        deliveryEnabled: form.deliveryEnabled,
        collectionEnabled: form.collectionEnabled,
        collectionInstructions: form.collectionInstructions.trim(),
        daysAhead: form.scheduling ? Number(form.daysAhead) : 0,
        slotLengthMins: Number(form.slotLengthMins),
        leadTimeMins: Number(form.leadTimeMins || 0),
        maxOrdersPerSlot: Number(form.maxOrdersPerSlot || 0),
      });
      toast.success('Saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Delivery & Collection"
        subtitle="How customers get their orders, and whether they can book a time."
        breadcrumbs={[{ label: 'Dashboard', to: '/vendor/dashboard' }, { label: 'Delivery & Collection' }]}
      />
      <form onSubmit={save} style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div className="card">
          <div className="card-header"><h3>Handover</h3></div>
          <div className="card-body space-y-4">
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', fontWeight: 600 }}>
              <input type="checkbox" checked={form.deliveryEnabled} onChange={(e) => set('deliveryEnabled', e.target.checked)} />
              <Truck size={16} /> Delivery
            </label>
            <p style={{ ...hint, marginTop: 0 }}>Uses your shipping methods and delivery radius.</p>
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', fontWeight: 600 }}>
              <input type="checkbox" checked={form.collectionEnabled} onChange={(e) => set('collectionEnabled', e.target.checked)} />
              <StoreIcon size={16} /> Click &amp; collect
            </label>
            <p style={{ ...hint, marginTop: 0 }}>No delivery charge. Customers tap "I've arrived" and you get an alert here and on your phone.</p>
            {form.collectionEnabled ? (
              <div className="form-group">
                <label className="form-label">Collection instructions</label>
                <input className="form-input" maxLength={300} value={form.collectionInstructions}
                  onChange={(e) => set('collectionInstructions', e.target.value)}
                  placeholder="e.g. Park in the loading bay and ring the side door" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3><CalendarClock size={16} style={{ display: 'inline', marginRight: 6 }} />Time slots</h3></div>
          <div className="card-body space-y-4">
            {!meta.hasHours ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: '#fef3c7', color: '#92400e', fontSize: 'var(--text-sm)' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>Slots are made from your opening hours. <Link to="/vendor/operating-hours">Set your operating hours</Link> first.</span>
              </div>
            ) : null}
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', fontWeight: 600 }}>
              <input type="checkbox" checked={form.scheduling} onChange={(e) => set('scheduling', e.target.checked)} />
              Let customers book a time
            </label>
            <p style={{ ...hint, marginTop: 0 }}>
              Off: orders are as soon as possible, while you're open. On: customers can also pick a slot, even when you're closed now. Times are in {meta.timezone}.
            </p>
            {form.scheduling ? (
              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Days ahead (today included)</label>
                  <input type="number" className="form-input" min="1" max="14" step="1" value={form.daysAhead} onChange={(e) => set('daysAhead', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Slot length</label>
                  <select className="form-select" value={form.slotLengthMins} onChange={(e) => set('slotLengthMins', e.target.value)}>
                    {[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n < 60 ? `${n} minutes` : `${n / 60} hour${n > 60 ? 's' : ''}`}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notice needed (minutes)</label>
                  <input type="number" className="form-input" min="0" max="1440" step="5" value={form.leadTimeMins} onChange={(e) => set('leadTimeMins', e.target.value)} />
                  <p style={hint}>Slots starting sooner than this aren't offered.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Orders per slot</label>
                  <input type="number" className="form-input" min="0" max="1000" step="1" value={form.maxOrdersPerSlot} onChange={(e) => set('maxOrdersPerSlot', e.target.value)} placeholder="No limit" />
                  <p style={hint}>Delivery and collection share it. Empty = no limit.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
