import { useState, useEffect } from 'react';
import { vendorService } from '../../../api/vendorService';
import toast from 'react-hot-toast';
import { MapPin } from 'lucide-react';

export default function LocationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    deliveryRadiusMiles: 10,
  });

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    try {
      setLoading(true);
      const data = await vendorService.getLocation();
      if (data) {
        setFormData({
          addressLine1: data.addressLine1 || '',
          addressLine2: data.addressLine2 || '',
          city: data.city || '',
          county: data.county || '',
          postcode: data.postcode || '',
          country: data.country || 'United Kingdom',
          deliveryRadiusMiles: data.deliveryRadiusMiles || 10,
        });
      }
    } catch (error) {
      toast.error('Failed to load location details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === 'deliveryRadiusMiles' ? Number(value) : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorService.updateLocation(formData);
      toast.success('Location updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update location');
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
          <h1>Store Location</h1>
          <p>Manage your address and delivery zone.</p>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        <div className="card">
          <div className="card-header">
            <h3>Address Details</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Address Line 1</label>
                <input
                  type="text"
                  className="form-input"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">City/Town</label>
                  <input
                    type="text"
                    className="form-input"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">County</label>
                  <input
                    type="text"
                    className="form-input"
                    name="county"
                    value={formData.county}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Postcode</label>
                  <input
                    type="text"
                    className="form-input"
                    name="postcode"
                    value={formData.postcode}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    className="form-input"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <label className="form-label">Delivery Radius (Miles)</label>
                <input
                  type="number"
                  className="form-input"
                  name="deliveryRadiusMiles"
                  min="0"
                  max="500"
                  value={formData.deliveryRadiusMiles}
                  onChange={handleChange}
                />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Set to 0 if you only offer nationwide shipping and don't do local delivery.
                </p>
              </div>

              <div style={{ paddingTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Placeholder for Map */}
        <div className="card">
          <div className="card-header">
            <h3>Map Preview</h3>
          </div>
          <div className="card-body flex items-center justify-center" style={{ minHeight: '300px', backgroundColor: 'var(--surface-50)', borderRadius: 'var(--radius-md)' }}>
            <div className="text-center empty-state">
              <div className="empty-state-icon">
                <MapPin size={32} />
              </div>
              <h4 style={{ marginBottom: '0.5rem' }}>Map Integration Pending</h4>
              <p style={{ maxWidth: '250px', margin: '0 auto' }}>
                A static or interactive map will be displayed here based on your address.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
