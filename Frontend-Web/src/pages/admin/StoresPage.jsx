import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import { Store, Activity, Ban } from 'lucide-react';

export default function StoresPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  
  const { data, loading, error } = useFetch('/admin/stores', {
    params: { page, limit: 20, status: filter || undefined },
  });

  const stores = data?.data || [];
  const total = data?.total || 0;

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
          <h1>Stores</h1>
          <p>View and manage all vendor stores on the platform</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Stores ({total})</h3>
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
                <th>Created</th>
                <th>Store Details</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div className="loading-overlay">
                      <div className="spinner"></div>
                      <p>Loading stores...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--status-red)' }}>
                    Error loading stores.
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Store />
                      </div>
                      <h3>No Stores Found</h3>
                      <p>There are currently no stores matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store._id}>
                    <td>{formatDate(store.createdAt)}</td>
                    <td>
                      <strong>{store.name}</strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        /{store.slug}
                      </div>
                    </td>
                    <td>
                      <div>{store.owner?.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        {store.owner?.email}
                      </div>
                    </td>
                    <td>
                      <div>{store.contact?.email || 'N/A'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        {store.contact?.phone || 'N/A'}
                      </div>
                    </td>
                    <td>{renderStatusBadge(store.status)}</td>
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
