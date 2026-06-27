import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import authService from '../../api/authService';
import client from '../../api/client';

const STEPS = [
  { id: 1, title: 'Account Details' },
  { id: 2, title: 'Store Information' },
];

export default function SignUpPage() {
  const navigate = useNavigate();

  /* ── Form state ─────────────────────────────────────────────────── */
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1 – Account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 – Store / Vendor Application
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCountry, setAddressCountry] = useState('');

  /* ── Auto-generate slug from store name ──────────────────────────── */
  const handleStoreNameChange = (val) => {
    setStoreName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    );
  };

  /* ── Validation ──────────────────────────────────────────────────── */
  const validateStep1 = () => {
    if (!name.trim() || name.trim().length < 2) return 'Name must be at least 2 characters.';
    if (!email.trim()) return 'Email is required.';
    if (!password || password.length < 8) return 'Password must be at least 8 characters.';
    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    if (!complexityRegex.test(password))
      return 'Password must contain upper, lower and numeric characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const validateStep2 = () => {
    if (!storeName.trim() || storeName.trim().length < 2)
      return 'Store name must be at least 2 characters.';
    if (!slug || slug.length < 2) return 'Store URL slug is required.';
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug))
      return 'Slug must be lowercase letters, numbers, and hyphens only.';
    return null;
  };

  /* ── Step navigation ─────────────────────────────────────────────── */
  const goNext = () => {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setStep(2);
  };

  const goBack = () => {
    setError('');
    setStep(1);
  };

  /* ── Submit ──────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      goNext();
      return;
    }

    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Register as a customer
      const registerRes = await authService.register(name.trim(), email.trim(), password);
      const { accessToken, refreshToken } = registerRes.data;

      // Store tokens temporarily so we can make the vendor application call
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // 2. Submit vendor application (requires auth)
      await client.post('/vendor-applications', {
        storeName: storeName.trim(),
        slug,
        description: description.trim(),
        contact: {
          phone: contactPhone.trim(),
          email: contactEmail.trim() || email.trim(),
        },
        address: {
          line1: addressLine1.trim(),
          city: addressCity.trim(),
          postalCode: addressPostalCode.trim(),
          country: addressCountry.trim(),
        },
      });

      // 3. Clear tokens — vendor cannot use the portal until admin approves
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      setSuccess(true);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Registration failed. Please try again.';
      setError(msg);

      // If registration succeeded but application failed, clean tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success state ───────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <div className="auth-card-header">
            <h2>Application Submitted</h2>
          </div>
          <div className="auth-card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#e8f5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}
            >
              <CheckCircle size={28} color="#5B9F12" />
            </div>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Thank You!</h3>
            <p style={{ color: 'var(--gray-600)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Your vendor application for <strong>{storeName}</strong> has been submitted
              successfully. The platform administrator will review your application and you will be
              notified via email once a decision is made.
            </p>
            <p style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>
              Once approved, you can log in to manage your store.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: 'var(--space-6)' }}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ─────────────────────────────────────────────────────────── */
  return (
    <div className="auth-layout">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="auth-card-header">
          <h2>Vendor Registration</h2>
        </div>

        <div className="auth-card-body">
          {/* Step indicator */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-6)',
              borderBottom: '1px solid var(--gray-200)',
              paddingBottom: 'var(--space-3)',
            }}
          >
            {STEPS.map((s) => (
              <div
                key={s.id}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: step === s.id ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                  color: step === s.id ? '#5B9F12' : 'var(--gray-400)',
                  borderBottom: step === s.id ? '2px solid #5B9F12' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                Step {s.id}: {s.title}
              </div>
            ))}
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-name">
                    Full Name*
                  </label>
                  <input
                    id="signup-name"
                    className="form-input"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-email">
                    Email*
                  </label>
                  <input
                    id="signup-email"
                    className="form-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-password">
                    Password*
                  </label>
                  <input
                    id="signup-password"
                    className="form-input"
                    type="password"
                    placeholder="Min 8 chars, upper + lower + number"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-confirm">
                    Confirm Password*
                  </label>
                  <input
                    id="signup-confirm"
                    className="form-input"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <div className="auth-form-actions">
                  <button type="submit" className="btn btn-primary" id="signup-next-btn">
                    Next: Store Details <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-storename">
                    Store Name*
                  </label>
                  <input
                    id="signup-storename"
                    className="form-input"
                    type="text"
                    placeholder="My Awesome Store"
                    value={storeName}
                    onChange={(e) => handleStoreNameChange(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-slug">
                    Store URL Slug*
                  </label>
                  <input
                    id="signup-slug"
                    className="form-input"
                    type="text"
                    placeholder="my-awesome-store"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  />
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--gray-500)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    marketplace.co.uk/stores/{slug || '...'}
                  </span>
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-description">
                    Description
                  </label>
                  <textarea
                    id="signup-description"
                    className="form-input"
                    rows={3}
                    placeholder="Tell us about your store…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-contact-phone">
                    Contact Phone
                  </label>
                  <input
                    id="signup-contact-phone"
                    className="form-input"
                    type="tel"
                    placeholder="+44 7700 900000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-contact-email">
                    Store Contact Email
                  </label>
                  <input
                    id="signup-contact-email"
                    className="form-input"
                    type="email"
                    placeholder="Defaults to your account email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-address">
                    Address Line 1
                  </label>
                  <input
                    id="signup-address"
                    className="form-input"
                    type="text"
                    placeholder="123 High Street"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-city">
                    City
                  </label>
                  <input
                    id="signup-city"
                    className="form-input"
                    type="text"
                    placeholder="London"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-postal">
                    Postal Code
                  </label>
                  <input
                    id="signup-postal"
                    className="form-input"
                    type="text"
                    placeholder="SW1A 1AA"
                    value={addressPostalCode}
                    onChange={(e) => setAddressPostalCode(e.target.value)}
                  />
                </div>

                <div className="auth-form-row">
                  <label className="form-label" htmlFor="signup-country">
                    Country
                  </label>
                  <input
                    id="signup-country"
                    className="form-input"
                    type="text"
                    placeholder="United Kingdom"
                    value={addressCountry}
                    onChange={(e) => setAddressCountry(e.target.value)}
                  />
                </div>

                <div
                  className="auth-form-actions"
                  style={{ display: 'flex', gap: 'var(--space-3)' }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={goBack}
                    id="signup-back-btn"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                    id="signup-submit-btn"
                  >
                    {submitting ? (
                      <>
                        <span
                          className="spinner"
                          style={{
                            width: 14,
                            height: 14,
                            borderWidth: 2,
                            borderTopColor: '#fff',
                          }}
                        />
                        Submitting…
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <div className="auth-info">
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#5B9F12', fontWeight: 'var(--weight-semibold)' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
