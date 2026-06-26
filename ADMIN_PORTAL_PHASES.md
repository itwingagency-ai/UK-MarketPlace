# 🛠️ UK Marketplace — Admin Portal Build Plan

> **Stack**: MERN (MongoDB · Express · React · Node.js)  
> **Style**: Active Admin-inspired — clean, data-dense, action-oriented  
> **Target**: `Frontend-Web/` directory  
> **Backend**: `Backend/` (existing — extend as required)

---

## 📋 Progress Overview

| Phase | Title                                   | Status         |
|-------|-----------------------------------------|----------------|
| 1     | Core System Foundation                  | 🔄 In Progress |
| 2     | Authentication & Access Control         | ⬜ Pending      |
| 3     | Shared UI Architecture & CRUD Framework | ⬜ Pending      |
| 4     | Vendor Dashboard & Store Management     | ⬜ Pending      |
| 5     | Product, Inventory & Category Management| ⬜ Pending      |
| 6     | Order Management, Reviews & Analytics   | ⬜ Pending      |
| 7     | Admin Panel & Platform Control          | ⬜ Pending      |

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

## Phase 2 — Authentication & Access Control ⬜

**Goal**: Fully working login/logout with JWT refresh, role-based routing.

### Deliverables

- [ ] Login page (email + password, role-based redirect)
- [ ] Token storage strategy (accessToken in memory, refreshToken in localStorage)
- [ ] Axios request interceptor for Bearer token injection
- [ ] Axios response interceptor for transparent token refresh (401 → /auth/refresh)
- [ ] Logout (revoke refresh token, clear state)
- [ ] Auth guard HOC (`<RequireAuth role="admin">`)
- [ ] Session persistence on page reload via silent refresh
- [ ] Unauthorized & Session Expired pages

---

## Phase 3 — Shared UI Architecture & CRUD Framework ⬜

**Goal**: Reusable component library following Active Admin patterns.

### Deliverables

- [ ] `<DataTable>` — sortable, paginated, searchable, bulk-selectable
- [ ] `<FilterBar>` — composable filter dropdowns and text inputs
- [ ] `<PageHeader>` — title, breadcrumbs, action buttons
- [ ] `<Modal>` and `<Drawer>` — confirmation dialogs, edit sidebars
- [ ] `<StatusBadge>` — colour-coded status chips
- [ ] `<FormBuilder>` — reusable form fields with validation
- [ ] `<StatCard>` — metric cards with trend indicators
- [ ] `<Pagination>` component
- [ ] Toast / notification system
- [ ] Skeleton loading states

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

- [ ] Vendor dashboard home — stat cards, revenue chart, recent orders
- [ ] Store settings page — name, description, logo, contact info
- [ ] Operating hours manager — weekly schedule with open/close toggles
- [ ] Location manager — address with map preview
- [ ] Shipping methods — CRUD table
- [ ] Analytics overview panel — sales trend chart, top products

---

## Phase 5 — Product, Inventory & Category Management ⬜

**Goal**: Full product catalog management with inventory controls.

### API Endpoints Used

- `GET/POST /api/v1/vendor/dashboard/products`
- `GET/PATCH/DELETE /api/v1/vendor/dashboard/products/:id`
- `PATCH /api/v1/vendor/dashboard/products/:id/restore`
- `GET/POST /api/v1/vendor/dashboard/categories`
- `GET/PATCH/DELETE /api/v1/vendor/dashboard/categories/:id`

### Deliverables

- [ ] Product list page — search, filter by category/status, sort, paginate
- [ ] Product create/edit form — name, images, pricing, stock, discounts
- [ ] Category management — tree or flat list CRUD
- [ ] Bulk actions — activate, deactivate, delete
- [ ] Low-stock indicator and stock quick-edit
- [ ] Soft delete + restore flow

---

## Phase 6 — Order Management, Reviews & Analytics ⬜

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

- [ ] Orders list — filter by status, date range, search
- [ ] Order detail page — customer info, items, payment, shipping events timeline
- [ ] Order status update controls
- [ ] Reviews list — rating distribution, respond, hide/unhide
- [ ] Analytics dashboard — charts for sales trend, category breakdown, customer insights
- [ ] Sales & product performance reports (downloadable CSV)

---

## Phase 7 — Admin Panel & Platform Control ⬜

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

- [ ] Admin dashboard — platform KPIs, recent activity, top stores
- [ ] Users management — list, view, suspend/reactivate
- [ ] Stores management — list, view, suspend/reactivate, set commission
- [ ] Vendor applications — review queue, approve/reject with notes
- [ ] All orders — cross-store order view
- [ ] Platform settings — commission rate, payment config
- [ ] Notification templates — event-based template editor
- [ ] Notification log — delivery history
- [ ] Reviews moderation — reports queue, approve/remove reviews
- [ ] Admin analytics — platform growth, revenue, store performance

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
