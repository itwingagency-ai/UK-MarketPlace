import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Repeat } from 'lucide-react';
import { vendorService } from '../../api/vendorService';
import { PageHeader, Skeleton } from '../../components/common';

/**
 * Repeat orders customers have set up with this store, by day, so you can
 * plan stock. Each one becomes a normal order on the day (from 07:00).
 */
const niceDate = (ymd) => new Date(`${ymd}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export default function RepeatOrdersPage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    vendorService.getUpcomingRepeatOrders(days)
      .then(setData)
      .catch(() => toast.error('Failed to load repeat orders'));
  }, [days]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const row of data?.data || []) {
      if (!map.has(row.date)) map.set(row.date, []);
      map.get(row.date).push(row);
    }
    return [...map.entries()];
  }, [data]);

  // What to have in stock across the period
  const totals = useMemo(() => {
    const t = new Map();
    for (const row of data?.data || []) for (const i of row.items) t.set(i.title, (t.get(i.title) || 0) + i.quantity);
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Repeat orders"
        subtitle="Regular orders customers have set up with you. Each becomes a normal order on its day."
        breadcrumbs={[{ label: 'Dashboard', to: '/vendor/dashboard' }, { label: 'Repeat orders' }]}
        actions={
          <select className="form-select" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={28}>Next 4 weeks</option>
          </select>
        }
      />
      {!data ? (
        <div className="card"><div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={4} /></div></div>
      ) : byDay.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
            <div className="empty-state-icon"><Repeat size={32} /></div>
            <h3>No repeat orders coming up</h3>
            <p>Customers can turn any order into a regular one from the app.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-5)', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {byDay.map(([date, rows]) => (
              <div className="card" key={date}>
                <div className="card-header"><h3>{niceDate(date)} · {rows.length} order{rows.length === 1 ? '' : 's'}</h3></div>
                <div className="table-responsive">
                  <table className="table">
                    <thead><tr><th>Customer</th><th>Handover</th><th>Items</th><th>Pays</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.subscriptionId}-${date}`}>
                          <td>{r.customerName}</td>
                          <td>{r.method === 'collection' ? 'Collects' : 'Delivery'}{r.preferredTime ? ` · around ${r.preferredTime}` : ''}</td>
                          <td style={{ fontSize: 'var(--text-sm)' }}>{r.items.map((i) => `${i.quantity} × ${i.title}`).join(', ')}</td>
                          <td>{r.paymentMethod === 'card' ? 'Card' : 'Cash'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><h3>Stock to plan for</h3></div>
            <div className="card-body">
              {totals.map(([title, qty]) => (
                <div key={title} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                  <span>{title}</span><strong>{qty}</strong>
                </div>
              ))}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
                Customers can still skip or pause, so treat this as a forecast.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
