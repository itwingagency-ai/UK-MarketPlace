# 🛠️ UK Marketplace — Admin Portal Build Plan

> **Stack**: MERN (MongoDB · Express · React · Node.js)  
> **Style**: Active Admin-inspired — clean, data-dense, action-oriented  
> **Target**: `Frontend-Web/` directory  
> **Backend**: `Backend/` (existing — extend as required)

---

## 📋 Progress Overview

| Phase | Title                                   | Status         |
|-------|-----------------------------------------|----------------|
| 1     | Core System Foundation                  | ✅ Done         |
| 2     | Authentication & Access Control         | ✅ Done         |
| 3     | Shared UI Architecture & CRUD Framework | ✅ Done         |
| 4     | Vendor Dashboard & Store Management     | ✅ Done         |
| 5     | Product, Inventory & Category Management| ✅ Done         |
| 6     | Order Management, Reviews & Analytics   | ✅ Done         |
| 7     | Admin Panel & Platform Control          | ✅ Done         |

---

## Phase 1 — Core System Foundation ✅

**Goal**: Scaffold the entire Frontend-Web React application with routing, design system, and role-based skeleton.

### Deliverables

- [x] Vite + React project initialised in `Frontend-Web/`
- [x] Folder architecture: `pages/`, `components/`, `layouts/`, `context/`, `hooks/`, `api/`, `utils/`
- [x] CSS design system (Active Admin aesthetic: indigo/slate palette, typography, spacing tokens)
- [x] React Router v6 with protected route guards
- [x] Auth context skeleton (login, logout, role storage)
- [x] API service layer (`api/client.js` with Axios + interceptors)
- [x] Role-based redirect logic (admin → /admin, vendor → /vendor)
- [x] 404 / Unauthorized pages
- [x] Placeholder shell layouts for Admin and Vendor portals

---

## Phase 2 — Authentication & Access Control ✅

**Goal**: Fully working login/logout with JWT refresh, role-based routing.

### Deliverables

- [x] Login page (email + password, role-based redirect)
- [x] Token storage strategy (accessToken in memory, refreshToken in localStorage)
- [x] Axios request interceptor for Bearer token injection
- [x] Axios response interceptor for transparent token refresh (401 → /auth/refresh)
- [x] Logout (revoke refresh token, clear state)
- [x] Auth guard HOC (`<RequireAuth role="admin">`)
- [x] Session persistence on page reload via silent refresh
- [x] Unauthorized & Session Expired pages

---

## Phase 3 — Shared UI Architecture & CRUD Framework ✅

**Goal**: Reusable component library following Active Admin patterns.

### Deliverables

- [x] `<DataTable>` — sortable, paginated, searchable, bulk-selectable
- [x] `<FilterBar>` — composable filter dropdowns and text inputs
- [x] `<PageHeader>` — title, breadcrumbs, action buttons
- [x] `<Modal>` and `<Drawer>` — confirmation dialogs, edit sidebars
- [x] `<StatusBadge>` — colour-coded status chips
- [x] `<FormBuilder>` — reusable form fields with validation
- [x] `<StatCard>` — metric cards with trend indicators
- [x] `<Pagination>` component
- [x] Toast / notification system
- [x] Skeleton loading states

---

## Phase 4 — Vendor Dashboard & Store Management ⬜

**Goal**: Store owners can manage their shop and view performance at a glance.

### API Endpoints Used

- `GET /api/v1/vendor/dashboard/overview`
- `GET /api/v1/vendor/dashboard/settings`
- `PATCH /api/v1/vendor/dashboard/settings`
- `GET /api/v1/vendor/dashboard/operating-hours`
- `PUT /api/v1/vendor/dashboard/operating-hours`
- `GET /api/v1/vendor/dashboard/location`
- `PATCH /api/v1/vendor/dashboard/location`
- `GET /api/v1/vendor/dashboard/shipping-methods`
- `POST/PATCH/DELETE /api/v1/vendor/dashboard/shipping-methods/:id`
- `GET /api/v1/vendor/dashboard/analytics/overview`

### Deliverables

- [x] Vendor dashboard home — stat cards, revenue chart, recent orders
- [x] Store settings page — name, description, logo, contact info
- [x] Operating hours manager — weekly schedule with open/close toggles
- [x] Location manager — address with map preview
- [x] Shipping methods — CRUD table
- [x] Analytics overview panel — sales trend chart, top products

---

## Phase 5 — Product, Inventory & Category Management ✅

**Goal**: Full product catalog management with inventory controls.

### API Endpoints Used

- `GET/POST /api/v1/vendor/dashboard/products`
- `GET/PATCH/DELETE /api/v1/vendor/dashboard/products/:id`
- `PATCH /api/v1/vendor/dashboard/products/:id/restore`
- `GET/POST /api/v1/vendor/dashboard/categories`
- `GET/PATCH/DELETE /api/v1/vendor/dashboard/categories/:id`

### Deliverables

- [x] Product list page — search, filter by category/status, sort, paginate
- [x] Product create/edit form — name, images, pricing, stock, discounts
- [x] Category management — tree or flat list CRUD
- [x] Bulk actions — activate, deactivate, delete
- [x] Low-stock indicator and stock quick-edit
- [x] Soft delete + restore flow

---

## Phase 6 — Order Management, Reviews & Analytics ✅

**Goal**: Full order lifecycle management and customer review tools.

### API Endpoints Used

- `GET /api/v1/vendor/dashboard/orders`
- `GET /api/v1/vendor/dashboard/orders/:id`
- `PATCH /api/v1/vendor/dashboard/orders/:id/status`
- `GET /api/v1/vendor/dashboard/reviews`
- `POST /api/v1/vendor/dashboard/reviews/:id/response`
- `PATCH /api/v1/vendor/dashboard/reviews/:id/hide`
- `GET /api/v1/vendor/dashboard/analytics/*`
- `GET /api/v1/vendor/dashboard/reports/*`

### Deliverables

- [x] Orders list — filter by status, date range, search
- [x] Order detail page — customer info, items, payment, shipping events timeline
- [x] Order status update controls
- [x] Reviews list — rating distribution, respond, hide/unhide
- [x] Analytics dashboard — charts for sales trend, category breakdown, customer insights
- [x] Sales & product performance reports (downloadable CSV)

---

## Phase 7 — Admin Panel & Platform Control ✅

**Goal**: Super-admin view of the entire platform.

### API Endpoints Used

- `GET /api/v1/admin/overview`
- `GET /api/v1/admin/users` + CRUD
- `GET /api/v1/admin/stores` + CRUD
- `GET /api/v1/admin/orders`
- `GET/PATCH /api/v1/admin/settings`
- `GET /api/v1/admin/commission/summary`
- `PATCH /api/v1/admin/stores/:storeId/commission`
- `GET /api/v1/admin/reviews` + moderation
- `GET /api/v1/admin/notifications/templates` + CRUD
- `GET /api/v1/admin/notifications/log`
- `GET /api/v1/admin/vendor-applications` + approve/reject

### Deliverables

- [x] Admin dashboard — platform KPIs, recent activity, top stores
- [x] Users management — list, view, suspend/reactivate
- [x] Stores management — list, view, suspend/reactivate, set commission
- [x] Vendor applications — review queue, approve/reject with notes
- [x] All orders — cross-store order view
- [x] Platform settings — commission rate, payment config
- [x] Notification templates — event-based template editor
- [x] Notification log — delivery history
- [x] Reviews moderation — reports queue, approve/remove reviews
- [x] Admin analytics — platform growth, revenue, store performance

---

## Architecture Notes

### Frontend-Web Structure
```
Frontend-Web/
├── src/
│   ├── api/              # Axios client + per-domain service files
│   ├── components/       # Shared reusable UI components
│   │   ├── common/       # Table, Modal, Badge, Button etc.
│   │   └── charts/       # Recharts wrappers
│   ├── context/          # AuthContext, ThemeContext
│   ├── hooks/            # useAuth, useFetch, useTable, etc.
│   ├── layouts/          # AdminLayout, VendorLayout, AuthLayout
│   ├── pages/
│   │   ├── auth/         # Login, Unauthorized
│   │   ├── admin/        # All admin pages
│   │   └── vendor/       # All vendor pages
│   ├── routes/           # Route definitions + guards
│   └── utils/            # formatters, constants
```

### Backend API Base URL
- Development: `http://localhost:5000`
- All vendor routes: `/api/v1/vendor/dashboard/*`
- All admin routes: `/api/v1/admin/*`
- Auth routes: `/api/v1/auth/*`

### Role → Portal Mapping
| Role       | After Login Redirect | Portal Root  |
|------------|---------------------|--------------|
| `admin`    | `/admin/dashboard`  | `/admin/*`   |
| `vendor`   | `/vendor/dashboard` | `/vendor/*`  |
| `customer` | Blocked / 403       | N/A          |
