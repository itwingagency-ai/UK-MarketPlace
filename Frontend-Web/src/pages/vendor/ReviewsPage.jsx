import { useState, useEffect, useCallback } from 'react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, DataTable, StatusBadge, Modal, StatCard } from '../../components/common';
import { formatDate, truncate } from '../../utils/formatters';
import {
  Star, MessageSquare, Eye, EyeOff, Send,
  Trash2, AlertCircle, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Star Rating Component ─────────────────────────────────────────── */
function StarRating({ rating, size = 14, showValue = false }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={size}
        className={`star ${i <= Math.round(rating) ? 'filled' : ''}`}
        fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
      />
    );
  }
  return (
    <span className="star-rating">
      {stars}
      {showValue && <span className="star-rating-value">{Number(rating).toFixed(1)}</span>}
    </span>
  );
}

/* ── Rating Distribution ───────────────────────────────────────────── */
function RatingDistribution({ reviews }) {
  const counts = [0, 0, 0, 0, 0]; // 1-star through 5-star
  (reviews || []).forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
  });
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="rating-distribution">
      {[5, 4, 3, 2, 1].map(star => (
        <div className="rating-bar-row" key={star}>
          <div className="rating-bar-label">
            {star} <Star size={10} fill="#f59e0b" color="#f59e0b" />
          </div>
          <div className="rating-bar-track">
            <div className="rating-bar-fill"
              style={{ width: total > 0 ? `${(counts[star - 1] / total) * 100}%` : '0%' }} />
          </div>
          <span className="rating-bar-count">{counts[star - 1]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Review Status Filters ─────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'hidden', label: 'Hidden' },
];

const RATING_OPTIONS = [
  { value: '', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  // Response modal
  const [responseModal, setResponseModal] = useState(null); // review object
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        rating: ratingFilter || undefined,
      };
      const res = await vendorService.getReviews(params);
      setReviews(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, ratingFilter]);

  const fetchStats = async () => {
    try {
      const res = await vendorService.getReviewStats();
      setStats(res.data || null);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  /* ── Actions ──────────────────────────────────────────────────────── */
  const openResponseModal = (review) => {
    setResponseModal(review);
    setResponseText(review.vendorResponse?.body || '');
  };

  const handleSaveResponse = async () => {
    if (!responseText.trim()) {
      toast.error('Response cannot be empty');
      return;
    }
    try {
      setSubmitting(true);
      await vendorService.respondToReview(responseModal._id, responseText.trim());
      toast.success('Response saved');
      setResponseModal(null);
      fetchReviews();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearResponse = async (reviewId) => {
    try {
      await vendorService.clearReviewResponse(reviewId);
      toast.success('Response cleared');
      setResponseModal(null);
      fetchReviews();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear response');
    }
  };

  const handleToggleVisibility = async (review) => {
    try {
      if (review.status === 'hidden') {
        await vendorService.unhideReview(review._id);
        toast.success('Review unhidden');
      } else {
        await vendorService.hideReview(review._id, 'Hidden by vendor');
        toast.success('Review hidden');
      }
      fetchReviews();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update review visibility');
    }
  };

  /* ── Table Columns ────────────────────────────────────────────────── */
  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: 'var(--gray-100)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {v?.images?.[0] ? (
              <img src={v.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Star size={12} color="var(--gray-400)" />
            )}
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            {truncate(v?.title || 'Unknown Product', 25)}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Customer',
      render: (v, row) => (
        <span style={{ fontSize: 'var(--text-sm)' }}>
          {v?.name || row.userSnapshot?.name || '—'}
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      width: 110,
      render: (v) => <StarRating rating={v} size={12} />,
    },
    {
      key: 'body',
      label: 'Review',
      render: (v, row) => (
        <div>
          {row.title && (
            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: 2 }}>
              {truncate(row.title, 30)}
            </div>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>
            {truncate(v || '', 50)}
          </span>
        </div>
      ),
    },
    {
      key: 'vendorResponse',
      label: 'Response',
      width: 100,
      render: (v) => (
        <span className={`response-indicator ${v?.body ? 'responded' : 'unanswered'}`}>
          {v?.body ? (
            <><CheckCircle size={10} /> Replied</>
          ) : (
            <><AlertCircle size={10} /> None</>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 100,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      width: 100,
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v)}</span>,
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Reviews"
        subtitle="Manage customer reviews and respond to feedback"
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Reviews' },
        ]}
      />

      {/* ── Stats Cards ── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 'var(--space-5)' }}>
        <StatCard
          label="Total Reviews"
          value={stats?.total || 0}
          icon={<Star size={18} />}
          color="#f59e0b"
        />
        <StatCard
          label="Average Rating"
          value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {(stats?.averageRating || 0).toFixed(1)}
              <StarRating rating={stats?.averageRating || 0} size={12} />
            </div>
          }
          icon={<Star size={18} />}
          color="#6366f1"
        />
        <StatCard
          label="Unanswered"
          value={stats?.unansweredCount || 0}
          icon={<MessageSquare size={18} />}
          color="#e65100"
        />
        <StatCard
          label="Hidden"
          value={stats?.byStatus?.hidden || 0}
          icon={<EyeOff size={18} />}
          color="#6b7280"
        />
      </div>

      {/* ── Rating Distribution ── */}
      <div className="card" style={{ padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          Rating Distribution
        </h3>
        <RatingDistribution reviews={reviews} />
      </div>

      {/* ── Reviews Table ── */}
      <div className="card">
        <div style={{
          display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-color)', background: 'var(--gray-50)',
        }}>
          <select className="form-input" value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ height: 34, fontSize: 'var(--text-sm)' }}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-input" value={ratingFilter}
            onChange={e => { setRatingFilter(e.target.value); setPage(1); }}
            style={{ height: 34, fontSize: 'var(--text-sm)' }}>
            {RATING_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <DataTable
          columns={columns}
          data={reviews}
          loading={loading}
          totalItems={total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          searchable
          searchValue={search}
          onSearch={handleSearch}
          rowKey="_id"
          emptyIcon={<Star />}
          emptyTitle="No Reviews Found"
          emptyText="No reviews match the selected filters."
          actions={(row) => (
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" title="Respond"
                onClick={() => openResponseModal(row)}>
                <MessageSquare size={14} />
              </button>
              <button className={`btn ${row.status === 'hidden' ? 'btn-success' : 'btn-ghost'} btn-sm`}
                title={row.status === 'hidden' ? 'Unhide' : 'Hide'}
                onClick={() => handleToggleVisibility(row)}>
                {row.status === 'hidden' ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          )}
        />
      </div>

      {/* ── Response Modal ── */}
      <Modal
        open={!!responseModal}
        onClose={() => !submitting && setResponseModal(null)}
        title="Respond to Review"
        size="md"
        footer={
          <>
            {responseModal?.vendorResponse?.body && (
              <button className="btn btn-ghost" onClick={() => handleClearResponse(responseModal._id)}
                disabled={submitting} style={{ marginRight: 'auto' }}>
                <Trash2 size={14} /> Clear Response
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setResponseModal(null)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveResponse} disabled={submitting}>
              <Send size={14} /> {submitting ? 'Saving…' : 'Save Response'}
            </button>
          </>
        }
      >
        {responseModal && (
          <div>
            {/* Review preview */}
            <div style={{
              padding: 'var(--space-3)', background: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)',
              border: '1px solid var(--gray-200)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <strong style={{ fontSize: 'var(--text-sm)' }}>
                  {responseModal.userSnapshot?.name || responseModal.user?.name || 'Customer'}
                </strong>
                <StarRating rating={responseModal.rating} size={12} />
              </div>
              {responseModal.title && (
                <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                  {responseModal.title}
                </div>
              )}
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', lineHeight: 1.5 }}>
                {responseModal.body || 'No review text.'}
              </p>
            </div>

            {/* Response textarea */}
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)', display: 'block' }}>
              Your Response
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Write your response to this review..."
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              style={{ fontSize: 'var(--text-sm)' }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
