import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Smartphone, Save } from 'lucide-react';
import { adminService } from '../../api/adminService';

/**
 * Mobile app version gate. Phones below "minimum" must update before using
 * the app; below "latest" they're asked once. Versions look like 1.2.3.
 */
const hint = { fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' };

export default function AppVersionSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService.getSettings()
      .then((res) => {
        const a = res?.data?.app || {};
        setForm({
          minVersion: a.minVersion || '0.0.0',
          latestVersion: a.latestVersion || '',
          iosUrl: a.iosUrl || '',
          androidUrl: a.androidUrl || '',
          message: a.message || '',
        });
      })
      .catch(() => toast.error('Failed to load app settings'));
  }, []);

  if (!form) return null;
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await adminService.updateSettings({ app: form });
      toast.success('App versions saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 800, marginTop: 'var(--space-6)' }}>
      <div className="card-header"><h3><Smartphone size={18} style={{ display: 'inline', marginRight: 8 }} />Mobile app versions</h3></div>
      <div className="card-body">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Minimum version</label>
              <input className="form-input" pattern="\d+(\.\d+){0,2}" value={form.minVersion} onChange={(e) => set('minVersion', e.target.value)} />
              <p style={hint}>Older apps are blocked until updated. Raise this only for breaking changes.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Latest version</label>
              <input className="form-input" pattern="\d+(\.\d+){0,2}" value={form.latestVersion} onChange={(e) => set('latestVersion', e.target.value)} placeholder="e.g. 1.4.0" />
              <p style={hint}>Older apps get a one-time "update available" prompt.</p>
            </div>
            <div className="form-group">
              <label className="form-label">App Store link</label>
              <input className="form-input" type="url" value={form.iosUrl} onChange={(e) => set('iosUrl', e.target.value)} placeholder="https://apps.apple.com/..." />
            </div>
            <div className="form-group">
              <label className="form-label">Google Play link</label>
              <input className="form-input" type="url" value={form.androidUrl} onChange={(e) => set('androidUrl', e.target.value)} placeholder="https://play.google.com/store/apps/details?id=com.ukmarketplace.app" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Message</label>
            <input className="form-input" maxLength={300} value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="What's new, shown with the update prompt" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save versions'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
