import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../api/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Bootstrap: try to restore user from localStorage ────────────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');
      if (stored && accessToken) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // corrupt storage – ignore
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Login ──────────────────────────────────────────────────────────── */
  const login = useCallback(async (email, password) => {
    const { data } = await authService.login(email, password);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    return data.user;
  }, []);

  /* ── Logout ─────────────────────────────────────────────────────────── */
  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // best-effort
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  /* ── Memoized value ─────────────────────────────────────────────────── */
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin: ['admin', 'superadmin', 'super_admin', 'super-admin', 'super admin'].includes(user?.role?.toLowerCase()),
      isVendor: user?.role === 'vendor',
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
