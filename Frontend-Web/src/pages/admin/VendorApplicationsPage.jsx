import { useState } from 'react';
import { PageHeader, DataTable, StatusBadge, Drawer, FilterBar } from '../../components/common';
import useFetch from '../../hooks/useFetch';
import client from '../../api/client';
import { formatDate } from '../../utils/formatters';
import { CheckCircle, XCircle, Clock, Eye, MapPin, Phone, Mail, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorApplicationsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '' });
  const [drawerApp, setDrawerApp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data, loading, error, refetch } = useFetch('/admin/vendor-applications', {
    params: { page, limit: 20, status: filters.status || undefined },
  });

  const applications = data?.data || [];
  const total = data?.total || 0;

  /* ── Load full application details ────────────────────────────────── */
  const openDetail = async (app) => {
    setDetailLoading(true);
    try {
      const { data: res } = await client.get(`/admin/vendor-applications/${app._id}`);
      setDrawerApp(res.data);
    } catch {
      setDrawerApp(app); // fallback to list data
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── Approve / Reject ─────────────────────────────────────────────── */
  const handleApprove = async (id) => {
    if (!window.confirm('Approve this application? This will create a store and promote the user to vendor.')) return;
    try {
      await client.patch(`/admin/vendor-applications/${id}/approve`);
      toast.success('Application approved — store created!');
      setDrawerApp(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Rejection reason (optional):');
    if (reason === null) return;
    try {
      await client.patch(`/admin/vendor-applications/${id}/reject`, { adminNote: reason });
      toast.success('Application rejected');
      setDrawerApp(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  /* ── Table columns ────────────────────────────────────────────────── */
  const columns = [
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      width: 110,
      render: (v) => formatDate(v),
    },
    {
      key: 'storeName',
      label: 'Store',
      sortable: true,
      render: (v, row) => (
        <div>
          <strong>{v}</strong>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
            /{row.slug}
          </div>
        </div>
      ),
    },
    {
      key: 'applicant',
      label: 'Applicant',
      render: (v) =>
        v ? (
          <div>
            <div>{v.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{v.email}</div>
          </div>
        ) : (
          'N/A'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 110,
      render: (v) => <StatusBadge status={v} />,
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Vendor Applications"
        subtitle="Review store registration requests from potential vendors"
        breadcrumbs={[
          { label: 'Admin', to: '/admin/dashboard' },
          { label: 'Vendor Applications' },
        ]}
      />

      <div className="card">
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ],
            },
          ]}
          values={filters}
          onChange={(key, val) => {
            setFilters((prev) => ({ ...prev, [key]: val }));
            setPage(1);
          }}
          onReset={() => {
            setFilters({ status: '' });
            setPage(1);
          }}
        />

        <DataTable
          columns={columns}
          data={applications}
          loading={loading}
          totalItems={total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          emptyIcon={<Clock />}
          emptyTitle="No Applications"
          emptyText="There are no vendor applications matching your criteria."
          actions={(row) => (
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openDetail(row)} title="View Details">
                <Eye size={14} /> View
              </button>
              {row.status === 'pending' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(row._id)}>
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleReject(row._id)}>
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}
            </div>
          )}
        />
      </div>

      {/* ── Application Detail Drawer ── */}
      <Drawer
        open={!!drawerApp}
        onClose={() => setDrawerApp(null)}
        title="Application Details"
        width={520}
        footer={
          drawerApp?.status === 'pending' && (
            <>
              <button className="btn btn-danger" onClick={() => handleReject(drawerApp._id)}>
                <XCircle size={14} /> Reject
              </button>
              <button className="btn btn-primary" onClick={() => handleApprove(drawerApp._id)}>
                <CheckCircle size={14} /> Approve
              </button>
            </>
          )
        }
      >
        {detailLoading ? (
          <div className="loading-overlay"><div className="spinner" /><p>Loading…</p></div>
        ) : drawerApp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Status */}
            <div>
              <StatusBadge status={drawerApp.status} />
              <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
                Submitted {formatDate(drawerApp.createdAt)}
              </span>
            </div>

            {/* Store Info */}
            <section>
              <h4 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                Store Information
              </h4>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Store Name</span>
                  <span className="detail-value">{drawerApp.storeName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">URL Slug</span>
                  <span className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>/{drawerApp.slug}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Subdomain</span>
                  <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--aa-green)' }}>
                    {drawerApp.slug}.marketplace.co.uk
                  </span>
                </div>
                {drawerApp.description && (
                  <div className="detail-row">
                    <span className="detail-label"><FileText size={12} /> Description</span>
                    <span className="detail-value">{drawerApp.description}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Applicant Info */}
            <section>
              <h4 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                Applicant
              </h4>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{drawerApp.applicant?.name || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label"><Mail size={12} /> Email</span>
                  <span className="detail-value">{drawerApp.applicant?.email || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Account Created</span>
                  <span className="detail-value">{formatDate(drawerApp.applicant?.createdAt)}</span>
                </div>
              </div>
            </section>

            {/* Contact Info */}
            {(drawerApp.contact?.phone || drawerApp.contact?.email) && (
              <section>
                <h4 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                  Store Contact
                </h4>
                <div className="detail-grid">
                  {drawerApp.contact?.phone && (
                    <div className="detail-row">
                      <span className="detail-label"><Phone size={12} /> Phone</span>
                      <span className="detail-value">{drawerApp.contact.phone}</span>
                    </div>
                  )}
                  {drawerApp.contact?.email && (
                    <div className="detail-row">
                      <span className="detail-label"><Mail size={12} /> Email</span>
                      <span className="detail-value">{drawerApp.contact.email}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Address */}
            {drawerApp.address?.line1 && (
              <section>
                <h4 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                  <MapPin size={12} /> Store Address
                </h4>
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">
                      {[drawerApp.address.line1, drawerApp.address.line2].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">City</span>
                    <span className="detail-value">{drawerApp.address.city || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Postal Code</span>
                    <span className="detail-value">{drawerApp.address.postalCode || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Country</span>
                    <span className="detail-value">{drawerApp.address.country || 'N/A'}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Admin Note */}
            {drawerApp.adminNote && (
              <section>
                <h4 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--gray-500)', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                  Admin Note
                </h4>
                <p style={{ background: 'var(--gray-50)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
                  {drawerApp.adminNote}
                </p>
              </section>
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
