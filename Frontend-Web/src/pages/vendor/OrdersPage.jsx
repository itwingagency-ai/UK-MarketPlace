import { useState, useEffect, useCallback } from 'react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';
import { formatDate, formatCurrency, formatSlot } from '../../utils/formatters';
import { ShoppingCart, Eye, User, Truck, Store as StoreIcon, Car } from 'lucide-react';
import { useLiveOrders } from '../../context/LiveOrdersContext';
import toast from 'react-hot-toast';
import OrderDetailDrawer from './OrderDetailDrawer';

const ORDER_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'ready_for_collection', label: 'Ready to collect' },
  { value: 'collected', label: 'Collected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const METHODS = [
  { value: '', label: 'Delivery & collection' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'collection', label: 'Collection' },
];

const PAYMENT_STATUSES = [
  { value: '', label: 'All Payments' },
  { value: 'pending', label: 'Pay Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [bySlot, setBySlot] = useState(false);

  // Drawer
  const [drawerOrderId, setDrawerOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        method: methodFilter || undefined,
        sort: bySlot ? 'slot' : undefined,
      };
      const res = await vendorService.getOrders(params);
      setOrders(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, paymentFilter, startDate, endDate, methodFilter, bySlot]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // New orders, status changes and arrivals from any device refresh the list
  useLiveOrders(() => { fetchOrders(); });

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  const columns = [
    {
      key: 'orderNumber',
      label: 'Order #',
      sortable: true,
      width: 120,
      render: (v) => (
        <strong style={{ color: 'var(--aa-link)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
          {v}
        </strong>
      ),
    },
    {
      key: 'customerSnapshot',
      label: 'Customer',
      render: (v, row) => {
        const name = v?.name || row.customer?.name || '—';
        const email = v?.email || row.customer?.email || '';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <User size={12} color="var(--gray-400)" />
              <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{name}</span>
            </div>
            {email && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{email}</div>}
          </div>
        );
      },
    },
    {
      key: 'fulfilment',
      label: 'Handover',
      width: 170,
      render: (f, row) => {
        const collecting = f?.method === 'collection';
        const Icon = collecting ? StoreIcon : Truck;
        const arrived = collecting && f?.arrivedAt && !['collected', 'cancelled'].includes(row.orderStatus);
        return (
          <div style={{ fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 600 }}>
              <Icon size={13} /> {collecting ? 'Collection' : 'Delivery'}
            </div>
            <div style={{ color: 'var(--gray-500)', fontSize: 'var(--text-xs)' }}>{formatSlot(f)}</div>
            {arrived ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b45309', fontWeight: 700, fontSize: 'var(--text-xs)' }}>
                <Car size={12} /> Customer outside
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      width: 100,
      render: (v) => <strong style={{ color: 'var(--gray-900)' }}>{formatCurrency(v || 0)}</strong>,
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      width: 100,
      render: (v, row) => (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', fontWeight: 600, color: 'var(--gray-600)' }}>
            {v || '—'}
          </div>
          <StatusBadge status={row.paymentStatus} size="sm" />
        </div>
      ),
    },
    {
      key: 'orderStatus',
      label: 'Status',
      sortable: true,
      width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      width: 110,
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Orders"
        subtitle="Manage customer orders and track fulfilment"
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Orders' },
        ]}
      />

      <div className="card">
        {/* Toolbar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-color)', background: 'var(--gray-50)',
          gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <select className="form-input" value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ height: 34, fontSize: 'var(--text-sm)' }}>
              {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="form-input" value={paymentFilter}
              onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
              style={{ height: 34, fontSize: 'var(--text-sm)' }}>
              {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="form-input" value={methodFilter} aria-label="Delivery or collection"
              onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
              style={{ height: 34, fontSize: 'var(--text-sm)' }}>
              {METHODS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={bySlot} onChange={e => { setBySlot(e.target.checked); setPage(1); }} />
              Soonest slot first
            </label>
          </div>
          <div className="date-range-group">
            <input type="date" className="form-input" value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }} />
            <span className="date-range-sep">to</span>
            <input type="date" className="form-input" value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }} />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          totalItems={total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          searchable
          searchValue={search}
          onSearch={handleSearch}
          rowKey="_id"
          emptyIcon={<ShoppingCart />}
          emptyTitle="No Orders Found"
          emptyText="No orders match the selected filters."
          actions={(row) => (
            <button className="btn btn-ghost btn-sm" title="View Order"
              onClick={() => setDrawerOrderId(row._id)}>
              <Eye size={14} /> View
            </button>
          )}
        />
      </div>

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        orderId={drawerOrderId}
        open={!!drawerOrderId}
        onClose={() => setDrawerOrderId(null)}
        onStatusChanged={fetchOrders}
      />
    </div>
  );
}
