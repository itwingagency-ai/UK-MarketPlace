import { useState, useEffect } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader } from '../../components/common';
import { Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    defaultCommissionRate: 10,
    platformFee: 0,
    supportEmail: '',
    autoApproveVendors: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await adminService.getSettings();
        if (res.data) {
          setSettings((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        toast.error('Failed to load platform settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await adminService.updateSettings({
        defaultCommissionRate: Number(settings.defaultCommissionRate),
        platformFee: Number(settings.platformFee),
        supportEmail: settings.supportEmail,
        autoApproveVendors: settings.autoApproveVendors,
      });
      toast.success('Platform settings updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-8"></div>
        <div className="card" style={{ height: '400px' }}></div>
      </div>
    );
  }

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Platform Settings"
        subtitle="Configure global settings, fees, and behaviours for the marketplace"
      />

      <div className="card" style={{ maxWidth: 800 }}>
        <div className="card-header">
          <h3>
            <Settings size={18} style={{ display: 'inline', marginRight: 8 }} />
            General Configuration
          </h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            <div className="form-group">
              <label className="form-label">Default Commission Rate (%)</label>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                The default percentage taken from each store's sales. This can be overridden per store.
              </p>
              <input
                type="number"
                className="form-input"
                name="defaultCommissionRate"
                value={settings.defaultCommissionRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fixed Platform Fee (£)</label>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                A fixed fee added to every order processed through the platform.
              </p>
              <input
                type="number"
                className="form-input"
                name="platformFee"
                value={settings.platformFee}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Support Email</label>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                The email address vendors and customers can use to contact platform support.
              </p>
              <input
                type="email"
                className="form-input"
                name="supportEmail"
                value={settings.supportEmail}
                onChange={handleChange}
                placeholder="support@ukmarketplace.com"
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <input
                type="checkbox"
                id="autoApproveVendors"
                name="autoApproveVendors"
                checked={settings.autoApproveVendors}
                onChange={handleChange}
                style={{ width: 18, height: 18 }}
              />
              <label htmlFor="autoApproveVendors" style={{ fontWeight: 500, cursor: 'pointer' }}>
                Auto-approve Vendor Applications
              </label>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginLeft: 30 }}>
              If enabled, new vendor applications will be automatically approved without manual review.
            </p>

            <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
