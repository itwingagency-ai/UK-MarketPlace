import { useState, useEffect } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, DataTable, Modal } from '../../components/common';
import { formatCurrency } from '../../utils/formatters';
import { DollarSign, Edit2, Store } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CommissionPage() {
  const [summary, setSummary] = useState({ revenue: 0, commission: 0, netToVendors: 0 });
  const [stores, setStores] = useState([]);
  const [platformConfig, setPlatformConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const [editingStore, setEditingStore] = useState(null);
  const [newCommission, setNewCommission] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCommissionData = async () => {
    try {
      setLoading(true);
      const [summaryRes, storesRes] = await Promise.all([
        adminService.getCommissionSummary(),
        adminService.getStores({ page, limit: 10, search })
      ]);
      
      if (summaryRes?.data) {
        setSummary(summaryRes.data.totals || { revenue: 0, commission: 0, netToVendors: 0 });
        setPlatformConfig(summaryRes.data.platform);
        
        const byStoreDict = {};
        if (summaryRes.data.byStore) {
          summaryRes.data.byStore.forEach(s => {
            byStoreDict[s.storeId] = s;
          });
        }
        
        setTotal(storesRes.total || 0);
        
        const combinedStores = (storesRes.data || []).map(store => {
          const stats = byStoreDict[store._id] || {};
          const isCustom = store.commissionRate !== null && store.commissionRate !== undefined;
          return {
            storeId: store._id,
            storeName: store.name,
            override: { commissionRate: store.commissionRate },
            revenue: stats.revenue || 0,
            commission: stats.commission || 0,
            effective: stats.effective || { 
              source: isCustom ? 'store' : 'platform',
              rate: isCustom ? store.commissionRate : summaryRes.data.platform?.defaultRate 
            }
          };
        });

        setStores(combinedStores);
      }
    } catch (err) {
      toast.error('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const handleEditCommission = (store) => {
    setEditingStore(store);
    const rate = store.override?.commissionRate;
    setNewCommission(rate !== null && rate !== undefined ? Number((rate * 100).toFixed(2)) : '');
  };

  const handleSaveCommission = async () => {
    try {
      setSaving(true);
      await adminService.setStoreCommission(editingStore.storeId, {
        type: newCommission === '' ? null : 'percentage',
        rate: newCommission === '' ? null : Number(newCommission) / 100
      });
      toast.success('Commission rate updated');
      setEditingStore(null);
      fetchCommissionData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update commission rate');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'storeName',
      label: 'Store Name',
      render: (v) => <strong style={{ color: 'var(--gray-900)' }}>{v || '—'}</strong>,
    },
    {
      key: 'revenue',
      label: 'Total Sales',
      render: (v) => formatCurrency(v || 0),
    },
    {
      key: 'commission',
      label: 'Platform Earnings',
      render: (v) => formatCurrency(v || 0),
    },
    {
      key: 'effective',
      label: 'Commission Rate',
      render: (v, row) => {
        const ratePct = v?.rate !== undefined ? Number((v.rate * 100).toFixed(2)) : 0;
        const isCustom = v?.source === 'store';
        return (
          isCustom ? (
            <span className="badge badge-primary">{ratePct}% (Custom)</span>
          ) : (
            <span className="badge badge-neutral">{ratePct}% (Platform)</span>
          )
        );
      },
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
          <div className="stat-card-value">{formatCurrency(summary.commission)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Pending Payouts (Net to Vendors)</span>
            <div className="stat-card-icon warning">
              <Store size={18} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(summary.netToVendors)}</div>
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
          rowKey="storeId"
        />
      </div>

      <Modal
        open={!!editingStore}
        onClose={() => setEditingStore(null)}
        title="Edit Commission Rate"
      >
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
            Set a custom commission rate for <strong>{editingStore?.storeName}</strong>. Leave blank to use the platform default.
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
