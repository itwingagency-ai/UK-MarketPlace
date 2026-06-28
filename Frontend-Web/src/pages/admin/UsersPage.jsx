import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import { Users, Ban, CheckCircle } from 'lucide-react';
import { adminService } from '../../api/adminService';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  
  const { data, loading, error, refetch } = useFetch('/admin/users', {
    params: { page, limit: 20, status: filter || undefined },
  });

  const users = data?.data || [];
  const total = data?.total || 0;

  const handleToggleStatus = async (user) => {
    try {
      if (user.status === 'active') {
        if (!window.confirm(`Are you sure you want to suspend ${user.name}?`)) return;
        await adminService.suspendUser(user._id, { reason: 'Admin suspended' });
        toast.success(`${user.name} has been suspended.`);
      } else {
        if (!window.confirm(`Are you sure you want to reactivate ${user.name}?`)) return;
        await adminService.reactivateUser(user._id);
        toast.success(`${user.name} has been reactivated.`);
      }
      refetch();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const renderStatusBadge = (status) => {
    if (status === 'active') {
      return (
        <span className="badge badge-success">
          <div className="badge-dot" /> Active
        </span>
      );
    }
    return (
      <span className="badge badge-danger">
        <div className="badge-dot" /> Suspended
      </span>
    );
  };

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Users</h1>
          <p>View and manage all platform users (customers and vendors)</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Platform Users ({total})</h3>
          <select 
            className="form-select" 
            value={filter} 
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Registered</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div className="loading-overlay">
                      <div className="spinner"></div>
                      <p>Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--status-red)' }}>
                    Error loading users.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Users />
                      </div>
                      <h3>No Users Found</h3>
                      <p>There are currently no users matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id}>
                    <td>{formatDate(user.createdAt)}</td>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                        {user.role}
                      </span>
                    </td>
                    <td>{renderStatusBadge(user.status)}</td>
                    <td>
                      <div className="action-buttons">
                        {user.role !== 'admin' && (
                          <button
                            className={`btn btn-sm ${user.status === 'active' ? 'btn-ghost-danger' : 'btn-ghost-success'}`}
                            onClick={() => handleToggleStatus(user)}
                            title={user.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                          >
                            {user.status === 'active' ? <Ban size={16} /> : <CheckCircle size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
