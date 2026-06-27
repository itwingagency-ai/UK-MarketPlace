import { useState, useEffect } from 'react';
import { vendorService } from '../../../api/vendorService';
import toast from 'react-hot-toast';

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    storeName: '',
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
      const data = await vendorService.getStoreSettings();
      setFormData({
        storeName: data.storeName || '',
        description: data.description || '',
        logoUrl: data.logoUrl || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
      });
    } catch (error) {
      toast.error('Failed to load store settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorService.updateStoreSettings(formData);
      toast.success('Store settings updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update store settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h3>Loading...</h3></div>;
  }

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Store Settings</h1>
          <p>Manage your store profile and contact information.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Store Name</label>
              <input
                type="text"
                className="form-input"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                required
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
              />
            </div>

            <div className="form-group">
              <label className="form-label">Logo URL</label>
              <input
                type="url"
                className="form-input"
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleChange}
                placeholder="https://example.com/logo.png"
              />
              {formData.logoUrl && (
                <img 
                  src={formData.logoUrl} 
                  alt="Store Logo" 
                  style={{ marginTop: '0.5rem', maxHeight: '100px', borderRadius: 'var(--radius-md)' }} 
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input
                type="email"
                className="form-input"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="text"
                className="form-input"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
              />
            </div>

            <div style={{ paddingTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
