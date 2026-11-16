import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Bike, KeyRound } from 'lucide-react';
import { vendorService } from '../../../api/vendorService';
import { PageHeader, Modal, StatusBadge, Skeleton } from '../../../components/common';

/**
 * The store's own delivery riders. Each rider signs in to the same mobile
 * app and sees only the deliveries you assign them.
 */
const EMPTY = { name: '', email: '', phone: '', password: '' };
const hint = { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' };

export default function RidersPage() {
  const [riders, setRiders] = useState(null);
  const [form, setForm] = useState(null);
  const [reset, setReset] = useState(null); // { id, name, password }
  const [saving, setSaving] = useState(false);

  const load = () =>
    vendorService.getRiders()
      .then((res) => setRiders(res?.data || []))
      .catch(() => toast.error('Failed to load riders'));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await vendorService.createRider({ ...form, email: form.email.trim(), name: form.name.trim() });
      toast.success(res.message);
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add the rider');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rider) => {
    try {
      await vendorService.updateRider(rider._id, { status: rider.status === 'active' ? 'suspended' : 'active' });
      toast.success(rider.status === 'active' ? `${rider.name} can no longer sign in` : `${rider.name} can sign in again`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update the rider');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorService.updateRider(reset.id, { password: reset.password });
      toast.success(`New password set for ${reset.name}`);
      setReset(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set the password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Riders"
        subtitle="Your own delivery riders. They use the same app and see only the orders you give them."
        breadcrumbs={[{ label: 'Dashboard', to: '/vendor/dashboard' }, { label: 'Riders' }]}
        actions={<button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Plus size={18} /> Add rider</button>}
      />
      <div className="card">
        {!riders ? (
          <div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={3} /></div>
        ) : riders.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
            <div className="empty-state-icon"><Bike size={32} /></div>
            <h3>No riders yet</h3>
            <p>Add a rider, then assign delivery orders to them from the order panel.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Name</th><th>Email (sign-in)</th><th>Phone</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.email}</td>
                    <td>{r.phone || '—'}</td>
                    <td><StatusBadge status={r.status} size="sm" /></td>
                    <td className="text-right">
                      <div className="flex justify-end" style={{ gap: '0.375rem' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setReset({ id: r._id, name: r.name, password: '' })}><KeyRound size={14} /> Password</button>
                        <button className="btn btn-sm btn-outline" onClick={() => toggle(r)}>{r.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="Add a rider"
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="rider-form" disabled={saving}>{saving ? 'Adding...' : 'Add rider'}</button>
          </div>
        }
      >
        {form ? (
          <form id="rider-form" onSubmit={create} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email (they sign in with this)</label>
              <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Starting password</label>
              <input className="form-input" type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p style={hint}>At least 8 characters with upper and lower case and a number. Give it to the rider in person.</p>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(reset)}
        onClose={() => setReset(null)}
        title={`New password for ${reset?.name || ''}`}
        size="sm"
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => setReset(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="reset-form" disabled={saving}>Save</button>
          </div>
        }
      >
        {reset ? (
          <form id="reset-form" onSubmit={savePassword}>
            <input className="form-input" type="text" required minLength={8} value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
