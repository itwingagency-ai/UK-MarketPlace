import { useState, useEffect, useMemo } from 'react';
import { vendorService } from '../../../api/vendorService';
import { PageHeader, Skeleton } from '../../../components/common';
import toast from 'react-hot-toast';
import { MapPin, Navigation, Truck } from 'lucide-react';

/* ── Location Skeleton ──────────────────────────────────────────────── */
function LocationSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Store Location" subtitle="Manage your address and delivery zone." />
      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <Skeleton variant="text" width="40%" height="1rem" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton variant="text" count={6} height="2.5rem" />
          </div>
        </div>
        <div>
          <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
            <Skeleton variant="rect" height={280} />
          </div>
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <Skeleton variant="text" width="60%" height="1rem" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

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
      if (data && data.data) {
        const loc = data.data;
        setFormData({
          addressLine1: loc.address?.line1 || '',
          addressLine2: loc.address?.line2 || '',
          city: loc.address?.city || '',
          county: loc.address?.state || '',
          postcode: loc.address?.postalCode || '',
          country: loc.address?.country || 'United Kingdom',
          deliveryRadiusMiles: Math.round((loc.deliveryRadiusKm || 8) / 1.60934),
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
      [name]: name === 'deliveryRadiusMiles' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      const isUK = ['united kingdom', 'uk', 'great britain', 'gb'].includes(formData.country.trim().toLowerCase());

      if (isUK) {
        const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(formData.postcode.trim())}/validate`);
        const pcData = await pcRes.json();
        if (!pcData.result) {
          toast.error('Invalid UK Postal Code.');
          setSaving(false);
          return;
        }
      } else {
        const intlRegex = /^[a-zA-Z0-9\s-]{3,10}$/;
        if (!intlRegex.test(formData.postcode.trim())) {
          toast.error('Invalid Postal Code format.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        addressDetails: {
          line1: formData.addressLine1.trim(),
          line2: formData.addressLine2.trim(),
          city: formData.city.trim(),
          state: formData.county.trim(),
          postalCode: formData.postcode.trim(),
          country: formData.country.trim(),
        },
        deliveryRadiusKm: formData.deliveryRadiusMiles * 1.60934,
      };

      await vendorService.updateLocation(payload);
      toast.success('Location updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  /* ── Build Map embed URL from exact address ── */
  const mapQuery = useMemo(() => {
    const parts = [formData.addressLine1, formData.addressLine2, formData.city, formData.postcode, formData.country].filter(Boolean);
    return parts.length > 0 ? encodeURIComponent(parts.join(', ')) : null;
  }, [formData.addressLine1, formData.addressLine2, formData.city, formData.postcode, formData.country]);

  if (loading) return <LocationSkeleton />;

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Store Location"
        subtitle="Manage your address and delivery zone."
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Location' },
        ]}
      />

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        {/* ── Address Form ── */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={16} />
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
                  id="address-line1"
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
                  id="address-line2"
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
                    id="city-input"
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
                    id="county-input"
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
                    id="postcode-input"
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
                    id="country-input"
                  />
                </div>
              </div>

              <div style={{ paddingTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving} id="save-location-btn">
                  {saving ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right Column: Map + Delivery ── */}
        <div>
          {/* Map Preview */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Navigation size={16} />
              <h3>Map Preview</h3>
            </div>
            <div className="card-body p-0">
              {mapQuery ? (
                <iframe
                  title="Store Location Map"
                  width="100%"
                  height="300"
                  style={{ border: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
                  src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                  loading="lazy"
                  id="location-map"
                />
              ) : (
                <div className="empty-state" style={{
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div className="empty-state-icon">
                    <MapPin size={28} />
                  </div>
                  <h4 style={{ marginBottom: '0.25rem' }}>No Address Set</h4>
                  <p>Enter your postcode and city to see the map preview.</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Radius */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={16} />
              <h3>Delivery Zone</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Delivery Radius (Miles)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={formData.deliveryRadiusMiles}
                    onChange={handleChange}
                    name="deliveryRadiusMiles"
                    style={{ flex: 1, accentColor: '#6366f1' }}
                    id="delivery-radius-slider"
                  />
                  <div style={{
                    minWidth: 60,
                    padding: '0.375rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-50)',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: 'var(--text-md)',
                  }}>
                    {formData.deliveryRadiusMiles} mi
                  </div>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  {formData.deliveryRadiusMiles === 0
                    ? 'Local delivery disabled — nationwide shipping only.'
                    : `Customers within ${formData.deliveryRadiusMiles} miles can receive local delivery.`}
                </p>
              </div>

              {/* Address Summary */}
              {formData.addressLine1 && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-50)',
                  border: '1px solid var(--border-color)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}>
                  <MapPin size={14} style={{ flexShrink: 0, marginTop: 2, color: '#6366f1' }} />
                  <div>
                    {formData.addressLine1}
                    {formData.addressLine2 && <>, {formData.addressLine2}</>}<br />
                    {formData.city}{formData.county && `, ${formData.county}`}<br />
                    {formData.postcode}, {formData.country}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
