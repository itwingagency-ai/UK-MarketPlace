import { useState, useEffect } from 'react';
import { vendorService } from '../../../api/vendorService';
import { PageHeader, Modal, StatusBadge, Skeleton } from '../../../components/common';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Truck, Package, AlertTriangle } from 'lucide-react';

/* ── Shipping Skeleton ──────────────────────────────────────────────── */
function ShippingSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Shipping Methods" subtitle="Configure your delivery and shipping options." />
      <div className="card">
        <div className="card-body">
          <Skeleton variant="text" width="100%" height="2.5rem" count={5} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function ShippingMethodsPage() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' });
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    name: '',
    fee: '',
    minDays: '',
    maxDays: '',
    isActive: true,
  });

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getShippingMethods();
      setMethods(res?.data || []);
    } catch (error) {
      toast.error('Failed to load shipping methods');
    } finally {
      setLoading(false);
    }
  };

  /* ── Modal Handlers ── */
  const openAddModal = () => {
    setFormData({ id: null, name: '', fee: '', minDays: '', maxDays: '', isActive: true });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (method) => {
    setFormData({
      id: method._id,
      name: method.name,
      fee: method.fee,
      minDays: method.minDays,
      maxDays: method.maxDays,
      isActive: method.isActive !== false,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      const payload = {
        name: formData.name,
        fee: Number(formData.fee),
        minDays: Number(formData.minDays),
        maxDays: Number(formData.maxDays),
        isActive: formData.isActive,
      };

      if (isEditing) {
        await vendorService.updateShippingMethod(formData.id, payload);
        toast.success('Shipping method updated');
      } else {
        await vendorService.createShippingMethod(payload);
        toast.success('Shipping method created');
      }

      setIsModalOpen(false);
      fetchMethods();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save shipping method');
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete Handlers ── */
  const confirmDelete = (method) => {
    setDeleteModal({ open: true, id: method._id, name: method.name });
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await vendorService.deleteShippingMethod(deleteModal.id);
      toast.success('Shipping method deleted');
      setDeleteModal({ open: false, id: null, name: '' });
      fetchMethods();
    } catch (error) {
      toast.error('Failed to delete shipping method');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && methods.length === 0) return <ShippingSkeleton />;

  const activeCount = methods.filter((m) => m.isActive !== false).length;

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Shipping Methods"
        subtitle="Configure your delivery and shipping options."
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Shipping Methods' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={openAddModal} id="add-shipping-btn">
            <Plus size={18} />
            Add Method
          </button>
        }
      />

      {/* ── Summary Banner ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-5)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-50)',
          border: '1px solid var(--border-color)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <Truck size={16} style={{ color: '#6366f1' }} />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{methods.length}</strong> shipping method{methods.length !== 1 ? 's' : ''} configured
          {' · '}
          <strong style={{ color: '#10b981' }}>{activeCount}</strong> active
        </span>
      </div>

      {/* ── Table ── */}
      <div className="card">
        {methods.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
            <div className="empty-state-icon">
              <Package size={32} />
            </div>
            <h3>No Shipping Methods</h3>
            <p>Add your first shipping method to start accepting orders with delivery.</p>
            <button className="btn btn-primary" onClick={openAddModal} style={{ marginTop: 'var(--space-4)' }}>
              <Plus size={18} />
              Add Shipping Method
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Method Name</th>
                  <th>Cost (£)</th>
                  <th>Estimated Time</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr key={method._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 32, height: 32,
                          borderRadius: 'var(--radius-md)',
                          background: method.isActive !== false ? '#6366f112' : 'var(--surface-50)',
                          color: method.isActive !== false ? '#6366f1' : 'var(--text-tertiary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Truck size={15} />
                        </div>
                        <strong>{method.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>£{Number(method.fee || 0).toFixed(2)}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {method.minDays} - {method.maxDays} days
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        status={method.isActive === false ? 'inactive' : 'active'}
                        size="sm"
                      />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end" style={{ gap: '0.375rem' }}>
                        <button
                          className="btn btn-icon"
                          onClick={() => openEditModal(method)}
                          title="Edit"
                          id={`edit-${method._id}`}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn btn-icon text-danger"
                          onClick={() => confirmDelete(method)}
                          title="Delete"
                          id={`delete-${method._id}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Shipping Method' : 'Add Shipping Method'}
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="shipping-form"
              className="btn btn-primary"
              disabled={saving}
              id="save-shipping-btn"
            >
              {saving ? 'Saving...' : 'Save Method'}
            </button>
          </div>
        }
      >
        <form id="shipping-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Method Name</label>
            <input
              type="text"
              className="form-input"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Standard Delivery"
              required
              id="shipping-name-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fee (£)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              name="fee"
              value={formData.fee}
              onChange={handleChange}
              required
              id="shipping-fee-input"
            />
          </div>

          <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Min Days</label>
              <input
                type="number"
                min="0"
                className="form-input"
                name="minDays"
                value={formData.minDays}
                onChange={handleChange}
                required
                id="shipping-min-days-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Days</label>
              <input
                type="number"
                min="0"
                className="form-input"
                name="maxDays"
                value={formData.maxDays}
                onChange={handleChange}
                required
                id="shipping-max-days-input"
              />
            </div>
          </div>

          <div className="form-group" style={{ paddingTop: '0.5rem' }}>
            <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem' }}>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                id="shipping-active-toggle"
              />
              <span>Active (visible to customers)</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null, name: '' })}
        title="Delete Shipping Method"
        size="sm"
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              onClick={() => setDeleteModal({ open: false, id: null, name: '' })}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              id="confirm-delete-btn"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: 'var(--radius-lg)',
            background: '#ef444412',
            color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <p style={{ marginBottom: '0.5rem' }}>
              Are you sure you want to delete <strong>"{deleteModal.name}"</strong>?
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              This action cannot be undone. Any orders using this shipping method won't be affected.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
