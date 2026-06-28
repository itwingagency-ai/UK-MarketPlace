import { useState, useEffect, useCallback } from 'react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, Skeleton, DataTable } from '../../components/common';
import { DollarSign, Percent, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function CommissionPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [settings, setSettings] = useState(null);

  // Ledger state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchLedger = useCallback(async (currentPage) => {
    try {
      setOrdersLoading(true);
      // Fetch delivered orders to form the commission ledger
      const res = await vendorService.getOrders({ page: currentPage, limit: 10, status: 'delivered' });
      setOrders(res.data || []);
      setTotalOrders(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Try to get commission rate from settings or overview
        const [overviewData, settingsData] = await Promise.all([
          vendorService.getDashboardOverview().catch(() => null),
          vendorService.getStoreSettings().catch(() => null)
        ]);
        
        setOverview(overviewData);
        setSettings(settingsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    fetchLedger(page);
  }, [page, fetchLedger]);

  if (loading) {
    return (
      <div className="animate-slide-up">
        <PageHeader title="Commission Overview" subtitle="View your commission summary and ledger." />
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <Skeleton variant="rect" height={100} />
          <Skeleton variant="rect" height={100} />
        </div>
        <Skeleton variant="rect" height={300} />
      </div>
    );
  }

  // Attempt to extract commission rate, defaulting to 15 if not provided by backend yet
  const commissionRate = settings?.commissionRate ?? overview?.commissionRate ?? 15;
  const totalSales = overview?.sales?.current || 0;
  const estimatedCommissionPaid = (totalSales * commissionRate) / 100;

  const columns = [
    {
      key: 'orderNumber',
      label: 'Order #',
      render: (v) => (
        <strong style={{ color: 'var(--aa-link)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
          {v}
        </strong>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
    {
      key: 'total',
      label: 'Order Total',
      render: (v) => <strong style={{ color: 'var(--gray-900)' }}>{formatCurrency(v || 0)}</strong>,
    },
    {
      key: 'commissionRateCol',
      label: 'Comm. Rate',
      render: () => <span className="badge badge-neutral">{commissionRate}%</span>,
    },
    {
      key: 'commissionFee',
      label: 'Comm. Fee',
      render: (_, row) => {
        const fee = ((row.total || 0) * commissionRate) / 100;
        return <span style={{ color: '#ef4444', fontWeight: 500 }}>-{formatCurrency(fee)}</span>;
      },
    },
    {
      key: 'netEarnings',
      label: 'Net Earnings',
      render: (_, row) => {
        const fee = ((row.total || 0) * commissionRate) / 100;
        const net = (row.total || 0) - fee;
        return <strong style={{ color: '#10b981' }}>{formatCurrency(net)}</strong>;
      },
    },
  ];

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Commission Overview"
        subtitle="View your commission rate, summary, and recent deductions."
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Commission' },
        ]}
      />

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Current Commission Rate</span>
            <div className="stat-card-icon" style={{ background: 'var(--primary-100)', color: 'var(--primary-600)' }}>
              <Percent size={18} />
            </div>
          </div>
          <div className="stat-card-value">{commissionRate}%</div>
          <div className="stat-card-trend">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Applied to all successful orders
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Est. Total Commission Paid</span>
            <div className="stat-card-icon warning">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(estimatedCommissionPaid)}</div>
          <div className="stat-card-trend">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Based on total sales of {formatCurrency(totalSales)}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} />
          <h3 style={{ margin: 0 }}>Transaction Ledger (Delivered Orders)</h3>
        </div>
        
        <DataTable
          columns={columns}
          data={orders}
          loading={ordersLoading}
          totalItems={totalOrders}
          page={page}
          pageSize={10}
          onPageChange={setPage}
          rowKey="_id"
          emptyTitle="No Completed Transactions"
          emptyText="Commission is calculated when an order is successfully delivered. You have no delivered orders yet."
        />
      </div>
    </div>
  );
}
