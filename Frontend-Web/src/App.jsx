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
import StorefrontPage from './pages/public/StorefrontPage';

/* ── Admin Pages ── */
import AdminDashboard from './pages/admin/AdminDashboard';
import VendorApplicationsPage from './pages/admin/VendorApplicationsPage';
import StoresPage from './pages/admin/StoresPage';
import UsersPage from './pages/admin/UsersPage';
import AllOrdersPage from './pages/admin/AllOrdersPage';
import ReviewsModerationPage from './pages/admin/ReviewsModerationPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import PlatformSettingsPage from './pages/admin/PlatformSettingsPage';
import CommissionPage from './pages/admin/CommissionPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';

/* ── Vendor Pages ── */
import VendorDashboard from './pages/vendor/VendorDashboard';
import StoreSettingsPage from './pages/vendor/settings/StoreSettingsPage';
import OperatingHoursPage from './pages/vendor/settings/OperatingHoursPage';
import LocationPage from './pages/vendor/settings/LocationPage';
import ShippingMethodsPage from './pages/vendor/settings/ShippingMethodsPage';
import VendorAnalyticsPage from './pages/vendor/VendorAnalyticsPage';
import ProductsPage from './pages/vendor/ProductsPage';
import CategoriesPage from './pages/vendor/CategoriesPage';
import OrdersPage from './pages/vendor/OrdersPage';
import ReviewsPage from './pages/vendor/ReviewsPage';
import ReportsPage from './pages/vendor/ReportsPage';
import CommissionPageVendor from './pages/vendor/CommissionPage';
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
          <Route path="/store/:slug" element={<StorefrontPage />} />

          {/* ─── Admin Routes (role: admin) ─── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin', 'super_admin', 'super-admin', 'super admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            {/* Phase 7 */}
            <Route path="stores" element={<StoresPage />} />
            <Route path="vendor-applications" element={<VendorApplicationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="orders" element={<AllOrdersPage />} />
            <Route path="reviews" element={<ReviewsModerationPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<PlatformSettingsPage />} />
            <Route path="commission" element={<CommissionPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
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
            {/* Phase 6 */}
            <Route path="orders" element={<OrdersPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="commission" element={<CommissionPageVendor />} />
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
