import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import client from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorApplicationsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  
  const { data, loading, error, refetch } = useFetch('/admin/vendor-applications', {
    params: { page, limit: 20, status: filter || undefined },
  });

  const applications = data?.data || [];
  const total = data?.total || 0;

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this application?')) return;
    try {
      await client.patch(`/admin/vendor-applications/${id}/approve`);
      toast.success('Application approved successfully');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve application');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (optional):');
    if (reason === null) return; // Cancelled

    try {
      await client.patch(`/admin/vendor-applications/${id}/reject`, { adminNote: reason });
      toast.success('Application rejected');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject application');
    }
  };

  const renderStatusBadge = (status) => {
    if (status === 'approved') {
      return (
        <span className="badge badge-success">
          <div className="badge-dot" /> Approved
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="badge badge-danger">
          <div className="badge-dot" /> Rejected
        </span>
      );
    }
    return (
      <span className="badge badge-warning">
        <div className="badge-dot" /> Pending
      </span>
    );
  };

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Vendor Applications</h1>
          <p>Review and manage new store requests</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Applications ({total})</h3>
          <select 
            className="form-select" 
            value={filter} 
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Store Name</th>
                <th>Applicant</th>
                <th>Contact</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div className="loading-overlay">
                      <div className="spinner"></div>
                      <p>Loading applications...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--status-red)' }}>
                    Error loading applications.
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Clock />
                      </div>
                      <h3>No Applications Found</h3>
                      <p>There are currently no vendor applications matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app._id}>
                    <td>{formatDate(app.createdAt)}</td>
                    <td>
                      <strong>{app.storeName}</strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        /{app.slug}
                      </div>
                    </td>
                    <td>
                      <div>{app.applicant?.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        {app.applicant?.email}
                      </div>
                    </td>
                    <td>
                      <div>{app.contact?.email || 'N/A'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        {app.contact?.phone || 'N/A'}
                      </div>
                    </td>
                    <td>{renderStatusBadge(app.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {app.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(app._id)}
                            title="Approve"
                          >
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReject(app._id)}
                            title="Reject"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
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
