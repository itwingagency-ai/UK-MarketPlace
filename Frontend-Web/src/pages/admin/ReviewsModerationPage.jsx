import { useState, useEffect } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, DataTable, StatusBadge } from '../../components/common';
import { formatDate } from '../../utils/formatters';
import { AlertTriangle, CheckCircle, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReviewsModerationPage() {
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'all'
  
  // Reports State
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);

  // All Reviews State
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const res = await adminService.getReviewReports({ page: reportPage, limit: 20 });
      setReports(res.data || []);
      setReportTotal(res.total || 0);
    } catch (err) {
      toast.error('Failed to fetch review reports');
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const res = await adminService.getReviews({ page: reviewPage, limit: 20 });
      setReviews(res.data || []);
      setReviewTotal(res.total || 0);
    } catch (err) {
      toast.error('Failed to fetch reviews');
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    } else {
      fetchReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportPage, reviewPage]);

  const handleResolveReport = async (reportId, action) => {
    if (!window.confirm(`Are you sure you want to resolve this report as ${action}?`)) return;
    try {
      await adminService.resolveReviewReport(reportId, { action });
      toast.success('Report resolved');
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve report');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) return;
    try {
      await adminService.deleteReview(reviewId);
      toast.success('Review deleted');
      if (activeTab === 'all') fetchReviews();
      else fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete review');
    }
  };

  const reportColumns = [
    {
      key: 'createdAt',
      label: 'Reported On',
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (v) => <strong style={{ color: 'var(--status-red)' }}>{v}</strong>,
    },
    {
      key: 'reviewContent',
      label: 'Review Snippet',
      render: (v, row) => (
        <div style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--text-sm)' }}>
          {row.review?.comment || '—'}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 200,
      render: (_, row) => (
        <div className="action-buttons">
          {row.status === 'pending' && (
            <>
              <button className="btn btn-ghost-success btn-sm" onClick={() => handleResolveReport(row._id, 'dismissed')} title="Dismiss Report">
                <CheckCircle size={16} />
              </button>
              <button className="btn btn-ghost-danger btn-sm" onClick={() => handleDeleteReview(row.review?._id)} title="Delete Review">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const reviewColumns = [
    {
      key: 'createdAt',
      label: 'Date',
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#f59e0b' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} fill={i < v ? 'currentColor' : 'none'} />
          ))}
        </div>
      ),
    },
    {
      key: 'comment',
      label: 'Comment',
      render: (v) => (
        <div style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--text-sm)' }}>
          {v || '—'}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 100,
      render: (_, row) => (
        <button className="btn btn-ghost-danger btn-sm" onClick={() => handleDeleteReview(row._id)} title="Delete Review">
          <Trash2 size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Review Moderation"
        subtitle="Manage reported content and moderate platform reviews"
      />

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)' }}>
          <button
            className={`btn btn-ghost ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
            style={activeTab === 'reports' ? { color: 'var(--primary-color)', borderBottom: '2px solid var(--primary-color)', borderRadius: 0 } : { borderRadius: 0 }}
          >
            Reported Reviews
          </button>
          <button
            className={`btn btn-ghost ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            style={activeTab === 'all' ? { color: 'var(--primary-color)', borderBottom: '2px solid var(--primary-color)', borderRadius: 0 } : { borderRadius: 0 }}
          >
            All Reviews
          </button>
        </div>

        {activeTab === 'reports' ? (
          <DataTable
            columns={reportColumns}
            data={reports}
            loading={reportsLoading}
            totalItems={reportTotal}
            page={reportPage}
            pageSize={20}
            onPageChange={setReportPage}
            rowKey="_id"
            emptyIcon={<AlertTriangle />}
            emptyTitle="No Reports"
            emptyText="There are no pending review reports."
          />
        ) : (
          <DataTable
            columns={reviewColumns}
            data={reviews}
            loading={reviewsLoading}
            totalItems={reviewTotal}
            page={reviewPage}
            pageSize={20}
            onPageChange={setReviewPage}
            rowKey="_id"
            emptyIcon={<Star />}
            emptyTitle="No Reviews"
            emptyText="There are no reviews on the platform."
          />
        )}
      </div>
    </div>
  );
}
