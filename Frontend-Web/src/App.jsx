import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

/* ── Layouts ── */
import AdminLayout from './layouts/AdminLayout';
import VendorLayout from './layouts/VendorLayout';

/* ── Auth Pages ── */
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

/* ── Admin Pages ── */
import AdminDashboard from './pages/admin/AdminDashboard';
import VendorApplicationsPage from './pages/admin/VendorApplicationsPage';
import StoresPage from './pages/admin/StoresPage';

/* ── Vendor Pages ── */
import VendorDashboard from './pages/vendor/VendorDashboard';
import StoreSettingsPage from './pages/vendor/settings/StoreSettingsPage';
import OperatingHoursPage from './pages/vendor/settings/OperatingHoursPage';
import LocationPage from './pages/vendor/settings/LocationPage';
import ShippingMethodsPage from './pages/vendor/settings/ShippingMethodsPage';
import VendorAnalyticsPage from './pages/vendor/VendorAnalyticsPage';
import ProductsPage from './pages/vendor/ProductsPage';
import CategoriesPage from './pages/vendor/CategoriesPage';
/* ── Shared ── */
import PlaceholderPage from './components/common/PlaceholderPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ─── Public Routes ─── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* ─── Admin Routes (role: admin) ─── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            {/* Phase 7 stubs */}
            {/* Phase 7 */}
            <Route path="stores" element={<StoresPage />} />
            <Route path="vendor-applications" element={<VendorApplicationsPage />} />
            <Route path="users" element={<PlaceholderPage title="User Management" description="Manage all platform users, suspend or reactivate accounts." phase={7} />} />
            <Route path="orders" element={<PlaceholderPage title="All Orders" description="Cross-store order monitoring and management." phase={7} />} />
            <Route path="reviews" element={<PlaceholderPage title="Review Moderation" description="Moderate customer reviews and handle reports." phase={7} />} />
            <Route path="notifications" element={<PlaceholderPage title="Notifications" description="Manage notification templates and view delivery logs." phase={7} />} />
            <Route path="settings" element={<PlaceholderPage title="Platform Settings" description="Configure commission rates, payment settings, and platform behaviour." phase={7} />} />
            <Route path="commission" element={<PlaceholderPage title="Commission Management" description="View commission summaries and set per-store rates." phase={7} />} />
            <Route path="analytics" element={<PlaceholderPage title="Platform Analytics" description="Platform-wide growth metrics and performance charts." phase={7} />} />
          </Route>

          {/* ─── Vendor Routes (role: vendor) ─── */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute allowedRoles={['vendor']}>
                <VendorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<VendorDashboard />} />
            {/* Phase 4 */}
            <Route path="settings" element={<StoreSettingsPage />} />
            <Route path="shipping" element={<ShippingMethodsPage />} />
            <Route path="operating-hours" element={<OperatingHoursPage />} />
            <Route path="location" element={<LocationPage />} />
            {/* Phase 5 */}
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            {/* Phase 6 stubs / Analytics (Phase 4 deliverables) */}
            <Route path="orders" element={<PlaceholderPage title="Orders" description="View and process customer orders through all lifecycle stages." phase={6} />} />
            <Route path="reviews" element={<PlaceholderPage title="Reviews" description="Manage customer reviews and respond to feedback." phase={6} />} />
            <Route path="analytics" element={<VendorAnalyticsPage />} />
            <Route path="reports" element={<PlaceholderPage title="Reports" description="Download sales and product performance reports." phase={6} />} />
            <Route path="commission" element={<PlaceholderPage title="Commission" description="View your commission summary and transaction ledger." phase={4} />} />
          </Route>

          {/* ─── Catch-all ─── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>

      {/* ── Toast Notifications ── */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          },
        }}
      />
    </AuthProvider>
  );
}
