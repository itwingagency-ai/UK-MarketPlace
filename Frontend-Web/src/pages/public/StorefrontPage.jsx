import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../../api/client';
import { Store, Package, MapPin, AlertCircle } from 'lucide-react';
import { Skeleton } from '../../components/common';

export default function StorefrontPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
        // Attempt to fetch public store details by slug
        const res = await client.get(`/public/stores/${slug}`);
        setStore(res.data);
      } catch (err) {
        setError(err.response?.status === 404 ? 'Store not found' : 'Failed to load store');
      } finally {
        setLoading(false);
      }
    };
    
    if (slug) fetchStore();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-6)' }}>
        <Skeleton variant="rect" height={200} style={{ marginBottom: 'var(--space-6)' }} />
        <Skeleton variant="text" count={3} />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-50)'
      }}>
        <div style={{ width: 80, height: 80, background: 'var(--error-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <AlertCircle size={32} color="var(--error-600)" />
        </div>
        <h2>{error || 'Store Not Found'}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
          The store you are looking for at <strong style={{ fontFamily: 'var(--font-mono)' }}>/{slug}</strong> does not exist or is currently inactive.
        </p>
        <Link to="/" className="btn btn-primary">Return Home</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-50)' }}>
      {/* Header Banner */}
      <div style={{
        height: 250,
        background: store.logoUrl ? `url(${store.logoUrl}) center/cover no-repeat` : 'var(--primary-600)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: 'var(--space-6)',
          left: 'var(--space-8)',
          color: 'white'
        }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 var(--space-2) 0' }}>{store.storeName || store.name}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', opacity: 0.9 }}>
            {store.location?.city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <MapPin size={14} /> {store.location.city}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Store size={14} /> @{slug}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-8)' }}>
        <div className="grid grid-cols-[2fr_1fr]" style={{ gap: 'var(--space-8)' }}>
          
          {/* Main Content Area */}
          <div>
            <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <h3>About the Store</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {store.description || 'Welcome to our store! We offer the best quality products.'}
              </p>
            </div>

            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-4)' }}>
                <Package size={18} />
                <h3 style={{ margin: 0 }}>Products</h3>
              </div>
              <div className="empty-state" style={{ minHeight: 200 }}>
                <Package size={32} color="var(--gray-300)" />
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>No products listed yet.</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <h4 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Store Info
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <li>
                  <strong>Joined: </strong>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {store.createdAt ? new Date(store.createdAt).toLocaleDateString() : 'Recently'}
                  </span>
                </li>
                {store.operatingHours && (
                  <li>
                    <strong>Hours: </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>Check details</span>
                  </li>
                )}
                {store.contactEmail && (
                  <li>
                    <strong>Contact: </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{store.contactEmail}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
