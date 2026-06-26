import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect based on role
  if (isAuthenticated && user) {
    const dest = user.role === 'admin' ? '/admin/dashboard' : '/vendor/dashboard';
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);

      if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedInUser.role === 'vendor') {
        navigate('/vendor/dashboard', { replace: true });
      } else {
        setError('Only admin and vendor accounts can access this portal.');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        {/* ── Active Admin-style dark header bar ── */}
        <div className="auth-card-header">
          <h2>UK Marketplace — Admin Portal Login</h2>
        </div>

        <div className="auth-card-body">
          {error && (
            <div className="auth-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-row">
              <label className="form-label" htmlFor="login-email">
                Email*
              </label>
              <input
                id="login-email"
                className="form-input"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="auth-form-row">
              <label className="form-label" htmlFor="login-password">
                Password*
              </label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="auth-form-actions">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
            </div>

            <div className="auth-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                id="login-submit-btn"
              >
                {submitting ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} />
                    Signing in…
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="auth-info">
          Only authorised admin and vendor accounts may sign in.
        </div>
      </div>
    </div>
  );
}
