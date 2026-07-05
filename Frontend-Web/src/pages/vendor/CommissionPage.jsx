import { useState, useEffect, useCallback } from 'react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, Skeleton, DataTable } from '../../components/common';
import { DollarSign, Percent, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function CommissionPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  // Ledger state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchLedger = useCallback(async (currentPage) => {
    try {
      setOrdersLoading(true);
      const res = await vendorService.getCommissionLedger({ page: currentPage, limit: 10 });
      setOrders(res.data || []);
      setTotalOrders(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await vendorService.getCommissionSummary();
        setSummary(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
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

  const commissionRate = (summary?.effectiveConfig?.rate ?? 0) * 100;
  const commissionType = summary?.effectiveConfig?.type ?? 'percentage';
  const commissionFixed = summary?.effectiveConfig?.fixed ?? 0;
  
  const renderCommissionConfig = () => {
    if (commissionType === 'percentage') return `${commissionRate}%`;
    if (commissionType === 'fixed') return formatCurrency(commissionFixed);
    if (commissionType === 'both') return `${commissionRate}% + ${formatCurrency(commissionFixed)}`;
    return 'N/A';
  };

  const totalSales = summary?.totals?.revenue || 0;
  const totalCommissionPaid = summary?.totals?.commission || 0;

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
      key: 'placedAt',
      label: 'Date',
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
    {
      key: 'total',
      label: 'Order Total',
      render: (v) => <strong style={{ color: 'var(--gray-900)' }}>{formatCurrency(v || 0)}</strong>,
    },
    {
      key: 'commissionConfig',
      label: 'Comm. Config',
      render: (_, row) => {
        const cType = row.commission?.type;
        if (!cType) return <span className="badge badge-neutral">N/A</span>;
        let text = '';
        if (cType === 'percentage') text = `${(row.commission.rate * 100).toFixed(1)}%`;
        else if (cType === 'fixed') text = formatCurrency(row.commission.fixed);
        else if (cType === 'both') text = `${(row.commission.rate * 100).toFixed(1)}% + ${formatCurrency(row.commission.fixed)}`;
        return <span className="badge badge-neutral">{text}</span>;
      },
    },
    {
      key: 'commissionFee',
      label: 'Comm. Fee',
      render: (_, row) => {
        const fee = row.commission?.amount || 0;
        return <span style={{ color: '#ef4444', fontWeight: 500 }}>-{formatCurrency(fee)}</span>;
      },
    },
    {
      key: 'netPayout',
      label: 'Net Earnings',
      render: (_, row) => {
        const net = row.netPayout || 0;
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
            <span className="stat-card-label">Current Commission Config</span>
            <div className="stat-card-icon" style={{ background: 'var(--primary-100)', color: 'var(--primary-600)' }}>
              <Percent size={18} />
            </div>
          </div>
          <div className="stat-card-value">{renderCommissionConfig()}</div>
          <div className="stat-card-trend">
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Applied to all successful orders
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Commission Paid</span>
            <div className="stat-card-icon warning">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalCommissionPaid)}</div>
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
          <h3 style={{ margin: 0 }}>Transaction Ledger (Paid Orders)</h3>
        </div>
        
        <DataTable
          columns={columns}
          data={orders}
          loading={ordersLoading}
          totalItems={totalOrders}
          page={page}
          pageSize={10}
          onPageChange={setPage}
          rowKey="id"
          emptyTitle="No Completed Transactions"
          emptyText="Commission is calculated when an order is successfully paid. You have no paid orders yet."
        />
      </div>
    </div>
  );
}
