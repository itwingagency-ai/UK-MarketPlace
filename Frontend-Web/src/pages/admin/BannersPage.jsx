import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Image as ImageIcon } from 'lucide-react';
import { adminService } from '../../api/adminService';
import { PageHeader, Modal, StatusBadge, Skeleton } from '../../components/common';
import { formatDate } from '../../utils/formatters';

/**
 * Home-screen banners in the shopping app. A banner can open a store (slug),
 * add a coupon to the basket, or open a link; with an area set it shows only
 * to customers within that distance (local campaigns).
 */
const EMPTY = {
  id: null, title: '', subtitle: '', targetType: 'none', targetValue: '', startsAt: '', endsAt: '',
  lat: '', lng: '', radiusKm: '', sortOrder: '0', isActive: true, file: null, imageUrl: '',
};
const TARGETS = [
  ['none', 'Nothing (information only)'],
  ['store', 'A store (its web address name, e.g. corner-grocer)'],
  ['coupon', 'A coupon code (added to the basket)'],
  ['url', 'A web page (https://...)'],
];
const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const live = (b) => {
  const now = Date.now();
  if (!b.isActive) return 'inactive';
  if (b.startsAt && new Date(b.startsAt) > now) return 'scheduled';
  if (b.endsAt && new Date(b.endsAt) <= now) return 'expired';
  return 'active';
};

export default function BannersPage() {
  const [banners, setBanners] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => adminService.getBanners().then((r) => setBanners(r?.data || [])).catch(() => toast.error('Failed to load banners'));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const edit = (b) => setForm({
    id: b._id, title: b.title, subtitle: b.subtitle || '', targetType: b.target?.type || 'none', targetValue: b.target?.value || '',
    startsAt: toDate(b.startsAt), endsAt: toDate(b.endsAt), lat: b.geo?.lat ?? '', lng: b.geo?.lng ?? '', radiusKm: b.geo?.radiusKm ?? '',
    sortOrder: String(b.sortOrder || 0), isActive: b.isActive !== false, file: null, imageUrl: b.imageUrl || '',
  });

  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('subtitle', form.subtitle.trim());
    fd.append('targetType', form.targetType);
    fd.append('targetValue', form.targetType === 'none' ? '' : form.targetValue.trim());
    fd.append('startsAt', form.startsAt ? new Date(`${form.startsAt}T00:00:00`).toISOString() : '');
    fd.append('endsAt', form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : '');
    fd.append('lat', form.lat);
    fd.append('lng', form.lng);
    fd.append('radiusKm', form.radiusKm);
    fd.append('sortOrder', form.sortOrder || '0');
    fd.append('isActive', form.isActive ? 'true' : 'false');
    if (form.file) fd.append('image', form.file);
    try {
      setSaving(true);
      if (form.id) await adminService.updateBanner(form.id, fd);
      else await adminService.createBanner(fd);
      toast.success('Banner saved');
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b) => {
    try {
      await adminService.deleteBanner(b._id);
      toast.success('Banner deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Home banners"
        subtitle="Promotions at the top of the shopping app. Give one an area to run a local campaign."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Home banners' }]}
        actions={<button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Plus size={18} /> New banner</button>}
      />
      <div className="card">
        {!banners ? <div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={3} /></div> : banners.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
            <div className="empty-state-icon"><ImageIcon size={32} /></div>
            <h3>No banners</h3>
            <p>The app shows nothing in this spot until you add one.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Banner</th><th>Opens</th><th>Where</th><th>When</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        {b.imageUrl ? <img src={b.imageUrl} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : null}
                        <div><strong>{b.title}</strong><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{b.subtitle}</div></div>
                      </div>
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{b.target?.type === 'none' ? '—' : `${b.target.type}: ${b.target.value}`}</td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{b.geo?.radiusKm ? `${b.geo.radiusKm} km around ${b.geo.lat}, ${b.geo.lng}` : 'Everywhere'}</td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{b.startsAt ? formatDate(b.startsAt) : 'Now'} – {b.endsAt ? formatDate(b.endsAt) : 'No end'}</td>
                    <td><StatusBadge status={live(b) === 'scheduled' ? 'pending' : live(b)} label={live(b)} size="sm" /></td>
                    <td className="text-right">
                      <div className="flex justify-end" style={{ gap: '0.375rem' }}>
                        <button className="btn btn-icon" onClick={() => edit(b)} title="Edit"><Edit2 size={15} /></button>
                        <button className="btn btn-icon text-danger" onClick={() => remove(b)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit banner' : 'New banner'}
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="banner-form" disabled={saving}>{saving ? 'Saving...' : 'Save banner'}</button>
          </div>
        }
      >
        {form ? (
          <form id="banner-form" onSubmit={save} className="space-y-4">
            <div className="form-group"><label className="form-label">Title</label><input className="form-input" required minLength={2} maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Subtitle</label><input className="form-input" maxLength={140} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label">Image (wide, about 3:1)</label>
              <input className="form-input" type="file" accept="image/*" onChange={(e) => set('file', e.target.files?.[0] || null)} />
              {form.imageUrl && !form.file ? <img src={form.imageUrl} alt="" style={{ marginTop: 8, width: 180, borderRadius: 6 }} /> : null}
            </div>
            <div className="form-group">
              <label className="form-label">Tapping it opens</label>
              <select className="form-select" value={form.targetType} onChange={(e) => set('targetType', e.target.value)}>
                {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {form.targetType !== 'none' ? (
                <input className="form-input" style={{ marginTop: 'var(--space-2)' }} required value={form.targetValue} onChange={(e) => set('targetValue', e.target.value)}
                  placeholder={form.targetType === 'url' ? 'https://...' : form.targetType === 'coupon' ? 'WELCOME5' : 'store-name'} />
              ) : null}
            </div>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group"><label className="form-label">Starts</label><input type="date" className="form-input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Ends</label><input type="date" className="form-input" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group"><label className="form-label">Area: latitude</label><input className="form-input" type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">longitude</label><input className="form-input" type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">radius (km)</label><input className="form-input" type="number" step="0.1" min="0.1" value={form.radiusKm} onChange={(e) => set('radiusKm', e.target.value)} /></div>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Leave the area empty to show it everywhere.</p>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group"><label className="form-label">Order (lower first)</label><input className="form-input" type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></div>
              <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', marginTop: 28 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active
              </label>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
