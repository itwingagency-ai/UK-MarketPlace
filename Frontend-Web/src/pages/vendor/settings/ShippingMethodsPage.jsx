import { useState, useEffect } from 'react';
import { vendorService } from '../../../api/vendorService';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function ShippingMethodsPage() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    cost: '',
    estimatedDays: '',
    isActive: true,
  });

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    try {
      setLoading(true);
      const data = await vendorService.getShippingMethods();
      setMethods(data || []);
    } catch (error) {
      toast.error('Failed to load shipping methods');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ id: null, name: '', cost: '', estimatedDays: '', isActive: true });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (method) => {
    setFormData({
      id: method._id,
      name: method.name,
      cost: method.cost,
      estimatedDays: method.estimatedDays,
      isActive: method.isActive !== false,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      const payload = {
        name: formData.name,
        cost: Number(formData.cost),
        estimatedDays: formData.estimatedDays,
        isActive: formData.isActive
      };

      if (isEditing) {
        await vendorService.updateShippingMethod(formData.id, payload);
        toast.success('Shipping method updated');
      } else {
        await vendorService.createShippingMethod(payload);
        toast.success('Shipping method created');
      }
      
      closeModal();
      fetchMethods();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save shipping method');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shipping method?')) return;
    
    try {
      await vendorService.deleteShippingMethod(id);
      toast.success('Shipping method deleted');
      fetchMethods();
    } catch (error) {
      toast.error('Failed to delete shipping method');
    }
  };

  if (loading && methods.length === 0) {
    return <div className="page-header"><h3>Loading...</h3></div>;
  }

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Shipping Methods</h1>
          <p>Configure your delivery and shipping options.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            Add Method
          </button>
        </div>
      </div>

      <div className="card">
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
              {methods.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center" style={{ padding: 'var(--space-8)' }}>
                    No shipping methods configured yet.
                  </td>
                </tr>
              ) : (
                methods.map(method => (
                  <tr key={method._id}>
                    <td><strong>{method.name}</strong></td>
                    <td>£{Number(method.cost).toFixed(2)}</td>
                    <td>{method.estimatedDays}</td>
                    <td>
                      <span className={`badge ${method.isActive === false ? 'badge-neutral' : 'badge-success'}`}>
                        {method.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end" style={{ gap: '0.5rem' }}>
                        <button 
                          className="btn btn-icon" 
                          onClick={() => openEditModal(method)}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn-icon text-danger" 
                          onClick={() => handleDelete(method._id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Basic Modal Implementation */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
            <div className="card-header flex justify-between">
              <h3>{isEditing ? 'Edit Shipping Method' : 'Add Shipping Method'}</h3>
              <button className="btn-icon" onClick={closeModal}>&times;</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  />
                </div>
                
                <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Cost (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      name="cost"
                      value={formData.cost}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estimated Days</label>
                    <input
                      type="text"
                      className="form-input"
                      name="estimatedDays"
                      value={formData.estimatedDays}
                      onChange={handleChange}
                      placeholder="e.g., 3-5 days"
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ paddingTop: '0.5rem' }}>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Active (visible to customers)
                  </label>
                </div>

                <div className="flex justify-end" style={{ gap: '0.5rem', paddingTop: '1rem' }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Method'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
