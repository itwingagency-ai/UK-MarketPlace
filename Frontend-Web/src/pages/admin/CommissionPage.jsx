import { useState, useEffect } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, DataTable, Modal } from '../../components/common';
import { formatCurrency } from '../../utils/formatters';
import { DollarSign, Edit2, Store } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CommissionPage() {
  const [summary, setSummary] = useState({ totalCommission: 0, pendingPayouts: 0 });
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const [editingStore, setEditingStore] = useState(null);
  const [newCommission, setNewCommission] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await adminService.getCommissionSummary();
      setSummary(res.data || { totalCommission: 0, pendingPayouts: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await adminService.getStores({ page, limit: 10, search });
      setStores(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const handleEditCommission = (store) => {
    setEditingStore(store);
    setNewCommission(store.commissionRate || '');
  };

  const handleSaveCommission = async () => {
    try {
      setSaving(true);
      await adminService.setStoreCommission(editingStore._id, {
        commissionRate: newCommission === '' ? null : Number(newCommission)
      });
      toast.success('Commission rate updated');
      setEditingStore(null);
      fetchStores();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update commission rate');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Store Name',
      render: (v) => <strong style={{ color: 'var(--gray-900)' }}>{v}</strong>,
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (v) => v?.name || '—',
    },
    {
      key: 'totalRevenue',
      label: 'Total Sales',
      render: (v) => formatCurrency(v || 0),
    },
    {
      key: 'commissionRate',
      label: 'Commission Rate',
      render: (v) => (
        v !== undefined && v !== null ? (
          <span className="badge badge-primary">{v}% (Custom)</span>
        ) : (
          <span className="badge badge-neutral">Platform Default</span>
        )
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 100,
      render: (_, row) => (
        <button className="btn btn-ghost btn-sm" onClick={() => handleEditCommission(row)}>
          <Edit2 size={14} /> Edit
        </button>
      ),
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Commission Management"
        subtitle="Track platform earnings and manage per-store commission overrides"
      />

      <div className="grid grid-cols-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Commission Earned</span>
            <div className="stat-card-icon success">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(summary.totalCommission)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Pending Payouts (Est.)</span>
            <div className="stat-card-icon warning">
              <Store size={18} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(summary.pendingPayouts)}</div>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={stores}
          loading={loading}
          totalItems={total}
          page={page}
          pageSize={10}
          onPageChange={setPage}
          searchable
          searchValue={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          rowKey="_id"
        />
      </div>

      <Modal
        isOpen={!!editingStore}
        onClose={() => setEditingStore(null)}
        title="Edit Commission Rate"
      >
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
            Set a custom commission rate for <strong>{editingStore?.name}</strong>. Leave blank to use the platform default.
          </p>
          <div className="form-group">
            <label className="form-label">Commission Rate (%)</label>
            <input
              type="number"
              className="form-input"
              value={newCommission}
              onChange={(e) => setNewCommission(e.target.value)}
              placeholder="e.g. 15"
              min="0"
              max="100"
              step="0.1"
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" onClick={() => setEditingStore(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveCommission} disabled={saving}>
            {saving ? 'Saving...' : 'Save Rate'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
