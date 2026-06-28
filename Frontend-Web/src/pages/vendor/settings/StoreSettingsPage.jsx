import { useState, useEffect, useRef } from 'react';
import { vendorService } from '../../../api/vendorService';
import { PageHeader, Skeleton } from '../../../components/common';
import toast from 'react-hot-toast';
import { Store, User, Phone, Mail, Image, AlertCircle } from 'lucide-react';

/* ── Settings Skeleton ──────────────────────────────────────────────── */
function SettingsSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Store Settings" subtitle="Manage your store profile and contact information." />
      <div style={{ maxWidth: '700px' }}>
        <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
          <Skeleton variant="text" width="30%" height="1rem" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton variant="text" count={3} height="2.5rem" />
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <Skeleton variant="text" width="30%" height="1rem" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton variant="text" count={2} height="2.5rem" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialData = useRef(null);

  const [formData, setFormData] = useState({
    storeName: '',
    slug: '',
    description: '',
    logoUrl: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const rawData = await vendorService.getStoreSettings();
      const data = rawData?.data || rawData || {}; // Fallback in case vendorService starts stripping data
      const normalized = {
        storeName: data.storeName || '',
        slug: data.slug || '',
        description: data.description || '',
        logoUrl: data.logoUrl || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
      };
      setFormData(normalized);
      initialData.current = JSON.stringify(normalized);
      setIsDirty(false);
    } catch (error) {
      toast.error('Failed to load store settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      setIsDirty(JSON.stringify(next) !== initialData.current);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorService.updateStoreSettings(formData);
      initialData.current = JSON.stringify(formData);
      setIsDirty(false);
      toast.success('Store settings updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update store settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Store Settings"
        subtitle="Manage your store profile and contact information."
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Store Settings' },
        ]}
        actions={
          isDirty && (
            <span className="badge badge-warning" style={{ animation: 'pulse 2s infinite' }}>
              <AlertCircle size={12} />
              Unsaved Changes
            </span>
          )
        }
      />

      <form onSubmit={handleSubmit} style={{ maxWidth: '700px' }}>
        {/* ── Profile Section ── */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={16} />
            <h3>Store Profile</h3>
          </div>
          <div className="card-body space-y-4">
            {/* Logo Preview */}
            <div className="form-group">
              <label className="form-label">Store Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 72, height: 72,
                  borderRadius: 'var(--radius-lg)',
                  border: '2px dashed var(--aa-panel-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  background: 'var(--surface-50)',
                  flexShrink: 0,
                }}>
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Store Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                    />
                  ) : null}
                  {!formData.logoUrl && (
                    <Image size={24} style={{ color: 'var(--text-tertiary)' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="url"
                    className="form-input"
                    name="logoUrl"
                    value={formData.logoUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/logo.png"
                  />
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                    Provide a URL to your store logo. Recommended size: 200×200px.
                  </p>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Store Name</label>
              <input
                type="text"
                className="form-input"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                required
                id="store-name-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                name="description"
                rows="4"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell your customers what makes your store special..."
                id="store-description-input"
              />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                {formData.description.length}/500 characters
              </p>
            </div>
          </div>
        </div>

        {/* ── Contact Section ── */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} />
            <h3>Contact Details</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Mail size={13} /> Contact Email
                </span>
              </label>
              <input
                type="email"
                className="form-input"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                id="contact-email-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Phone size={13} /> Contact Phone
                </span>
              </label>
              <input
                type="text"
                className="form-input"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="+44 7XXX XXXXXX"
                id="contact-phone-input"
              />
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !isDirty} id="save-settings-btn">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {isDirty && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setFormData(JSON.parse(initialData.current));
                setIsDirty(false);
              }}
            >
              Discard Changes
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
