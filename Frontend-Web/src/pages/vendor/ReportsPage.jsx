import { useState } from 'react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, Skeleton } from '../../components/common';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { FileText, Download, BarChart3, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Helper: trigger CSV download ─────────────────────────────────── */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toISODate(d) { return d.toISOString().split('T')[0]; }

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return { start: toISODate(start), end: toISODate(end) };
}

/* ── Report Card Component ─────────────────────────────────────────── */
function ReportCard({ title, description, icon: Icon, iconColor, children,
  onPreview, onDownload, previewLoading, downloadLoading }) {
  return (
    <div className="report-card">
      <div className="report-card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: `${iconColor}15`, color: iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} />
            </div>
            <div className="report-card-title">{title}</div>
          </div>
          <div className="report-card-desc">{description}</div>
        </div>
      </div>
      <div className="report-card-body">{children}</div>
      <div className="report-card-footer">
        <button className="btn btn-ghost btn-sm" onClick={onPreview} disabled={previewLoading}>
          {previewLoading ? 'Loading…' : 'Preview'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={onDownload} disabled={downloadLoading}>
          <Download size={14} /> {downloadLoading ? 'Downloading…' : 'Download CSV'}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const def = defaultRange();

  // Sales report state
  const [salesStart, setSalesStart] = useState(def.start);
  const [salesEnd, setSalesEnd] = useState(def.end);
  const [salesPreview, setSalesPreview] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesDownloading, setSalesDownloading] = useState(false);

  // Product report state
  const [prodStart, setProdStart] = useState(def.start);
  const [prodEnd, setProdEnd] = useState(def.end);
  const [prodPreview, setProdPreview] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodDownloading, setProdDownloading] = useState(false);

  /* ── Sales Report ─────────────────────────────────────────────────── */
  const previewSales = async () => {
    try {
      setSalesLoading(true);
      const res = await vendorService.getSalesReport({
        startDate: salesStart, endDate: salesEnd,
      });
      setSalesPreview(res);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load sales report');
    } finally {
      setSalesLoading(false);
    }
  };

  const downloadSales = async () => {
    try {
      setSalesDownloading(true);
      const blob = await vendorService.getSalesReportCsv({
        startDate: salesStart, endDate: salesEnd,
      });
      downloadBlob(blob, `sales-report-${salesStart}-to-${salesEnd}.csv`);
      toast.success('Sales report downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download sales report');
    } finally {
      setSalesDownloading(false);
    }
  };

  /* ── Product Report ───────────────────────────────────────────────── */
  const previewProducts = async () => {
    try {
      setProdLoading(true);
      const res = await vendorService.getProductReport({
        startDate: prodStart, endDate: prodEnd,
      });
      setProdPreview(res);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load product report');
    } finally {
      setProdLoading(false);
    }
  };

  const downloadProducts = async () => {
    try {
      setProdDownloading(true);
      const blob = await vendorService.getProductReportCsv({
        startDate: prodStart, endDate: prodEnd,
      });
      downloadBlob(blob, `product-report-${prodStart}-to-${prodEnd}.csv`);
      toast.success('Product report downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download product report');
    } finally {
      setProdDownloading(false);
    }
  };

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Download sales and product performance reports"
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Reports' },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* ── Sales Report Card ── */}
        <ReportCard
          title="Sales Report"
          description="Detailed breakdown of all orders, revenue, shipping fees, and payment methods within the selected period."
          icon={ShoppingCart}
          iconColor="#6366f1"
          onPreview={previewSales}
          onDownload={downloadSales}
          previewLoading={salesLoading}
          downloadLoading={salesDownloading}
        >
          {/* Date range */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--gray-600)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Date Range
            </label>
            <div className="date-range-group">
              <input type="date" className="form-input" value={salesStart}
                onChange={e => setSalesStart(e.target.value)} />
              <span className="date-range-sep">to</span>
              <input type="date" className="form-input" value={salesEnd}
                onChange={e => setSalesEnd(e.target.value)} />
            </div>
          </div>

          {/* Preview table */}
          {salesLoading ? (
            <Skeleton variant="rect" height={120} />
          ) : salesPreview ? (
            <div style={{ overflowX: 'auto' }}>
              {salesPreview.summary && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
                }}>
                  {[
                    { label: 'Total Orders', value: salesPreview.summary.totalOrders || 0 },
                    { label: 'Revenue', value: formatCurrency(salesPreview.summary.totalRevenue || 0) },
                    { label: 'Shipping', value: formatCurrency(salesPreview.summary.totalShipping || 0) },
                    { label: 'Avg Order', value: formatCurrency(salesPreview.summary.averageOrderValue || 0) },
                  ].map((m, i) => (
                    <div key={i} style={{
                      padding: 'var(--space-3)', background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-md)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--gray-800)' }}>
                        {m.value}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sample rows */}
              {salesPreview.data && salesPreview.data.length > 0 && (
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPreview.data.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                          {row.orderNumber}
                        </td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>{row.customerSnapshot?.name || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(row.total || 0)}
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: 'var(--text-xs)' }}>
                          {row.orderStatus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {salesPreview.data && salesPreview.data.length > 5 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                  Showing 5 of {salesPreview.total || salesPreview.data.length} records. Download CSV for full data.
                </p>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--gray-400)' }}>
              <FileText size={32} style={{ marginBottom: 'var(--space-2)' }} />
              <p style={{ fontSize: 'var(--text-sm)' }}>Select a date range and click Preview to see report data.</p>
            </div>
          )}
        </ReportCard>

        {/* ── Product Performance Report Card ── */}
        <ReportCard
          title="Product Performance Report"
          description="Product-level metrics including units sold, revenue, average price, and performance ranking."
          icon={BarChart3}
          iconColor="#10b981"
          onPreview={previewProducts}
          onDownload={downloadProducts}
          previewLoading={prodLoading}
          downloadLoading={prodDownloading}
        >
          {/* Date range */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--gray-600)', marginBottom: 'var(--space-1)', display: 'block' }}>
              Date Range
            </label>
            <div className="date-range-group">
              <input type="date" className="form-input" value={prodStart}
                onChange={e => setProdStart(e.target.value)} />
              <span className="date-range-sep">to</span>
              <input type="date" className="form-input" value={prodEnd}
                onChange={e => setProdEnd(e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          {prodLoading ? (
            <Skeleton variant="rect" height={120} />
          ) : prodPreview ? (
            <div style={{ overflowX: 'auto' }}>
              {prodPreview.data && prodPreview.data.length > 0 && (
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Units Sold</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodPreview.data.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{row.title || row.name || 'Unknown'}</td>
                        <td style={{ textAlign: 'right' }}>{row.unitsSold || row.totalSold || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(row.revenue || row.totalRevenue || 0)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(row.averagePrice || row.avgPrice || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {prodPreview.data && prodPreview.data.length > 8 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                  Showing 8 of {prodPreview.total || prodPreview.data.length} records. Download CSV for full data.
                </p>
              )}
              {(!prodPreview.data || prodPreview.data.length === 0) && (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--gray-400)' }}>
                  <p style={{ fontSize: 'var(--text-sm)' }}>No product data found for this date range.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--gray-400)' }}>
              <FileText size={32} style={{ marginBottom: 'var(--space-2)' }} />
              <p style={{ fontSize: 'var(--text-sm)' }}>Select a date range and click Preview to see report data.</p>
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
