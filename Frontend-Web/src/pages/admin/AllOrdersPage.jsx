import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { ShoppingCart, User, Store } from 'lucide-react';
import toast from 'react-hot-toast';

const ORDER_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_STATUSES = [
  { value: '', label: 'All Payments' },
  { value: 'pending', label: 'Pay Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function AllOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      };
      const res = await adminService.getOrders(params);
      setOrders(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, paymentFilter, startDate, endDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
      key: 'storeSnapshot',
      label: 'Store',
      render: (v, row) => {
        const storeName = v?.name || row.store?.name || '—';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Store size={12} color="var(--gray-400)" />
            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{storeName}</span>
          </div>
        );
      },
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
      <div className="page-header">
        <div className="page-header-info">
          <h1>All Orders</h1>
          <p>Cross-store order monitoring and tracking</p>
        </div>
      </div>

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
          emptyText="No orders match the selected filters across any store."
        />
      </div>
    </div>
  );
}
