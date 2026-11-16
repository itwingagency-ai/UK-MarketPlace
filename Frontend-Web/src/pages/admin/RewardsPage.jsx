import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Gift, Search, Check, X, Plus } from 'lucide-react';
import { adminService } from '../../api/adminService';
import { PageHeader, Modal, StatusBadge, Skeleton } from '../../components/common';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

/**
 * Rewards points and referrals: settings, the points ledger (with what
 * unspent points would cost), manual adjustments, and referrals held for
 * review. Points are paid for by the platform; stores opt in themselves.
 */
const hint = { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' };
const apiMessage = (err, fallback) => err?.response?.data?.message || fallback;
const pounds = (p) => (p ? (p / 100).toFixed(2) : '');
const pence = (s) => Math.round(Number(s || 0) * 100);

const TYPE_LABELS = {
  earn: 'Earned', redeem: 'Spent', restore: 'Returned', reverse: 'Taken back',
  expire: 'Expired', referral: 'Referral', adjust: 'Adjustment',
};
const FLAG_LABELS = {
  same_phone: 'Same phone', same_address: 'Same address', same_device: 'Same device', unverified_referee: 'Friend not verified',
};

function SettingsCard() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService.getSettings()
      .then((res) => {
        const L = res?.data?.loyalty || {};
        const R = L.referral || {};
        setForm({
          enabled: Boolean(L.enabled),
          earnPointsPerPound: String(L.earnPointsPerPound ?? 1),
          pointValuePence: String(L.pointValuePence ?? 1),
          minRedeemPoints: String(L.minRedeemPoints ?? 100),
          maxRedeemPoints: L.maxRedeemPoints ? String(L.maxRedeemPoints) : '',
          minBasketToRedeem: pounds(L.minBasketToRedeem),
          expiryMonths: String(L.expiryMonths ?? 12),
          referralEnabled: Boolean(R.enabled),
          referrerPoints: String(R.referrerPoints ?? 500),
          refereeCouponValue: pounds(R.refereeCouponValue ?? 500),
          refereeMinSubtotal: pounds(R.refereeMinSubtotal ?? 1500),
        });
      })
      .catch(() => toast.error('Failed to load rewards settings'));
  }, []);

  if (!form) return <div className="card"><div className="card-body"><Skeleton variant="text" width="100%" height="2.5rem" count={4} /></div></div>;
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const int = (s) => parseInt(s || '0', 10);

  const save = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await adminService.updateSettings({
        loyalty: {
          enabled: form.enabled,
          earnPointsPerPound: int(form.earnPointsPerPound),
          pointValuePence: int(form.pointValuePence),
          minRedeemPoints: int(form.minRedeemPoints),
          maxRedeemPoints: int(form.maxRedeemPoints),
          minBasketToRedeem: pence(form.minBasketToRedeem),
          expiryMonths: int(form.expiryMonths),
          referral: {
            enabled: form.referralEnabled,
            referrerPoints: int(form.referrerPoints),
            refereeCouponValue: pence(form.refereeCouponValue),
            refereeMinSubtotal: pence(form.refereeMinSubtotal),
          },
        },
      });
      toast.success('Rewards settings saved');
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const worth = int(form.pointValuePence) > 0 ? Math.round(100 / int(form.pointValuePence)) : 0;

  return (
    <form className="card" onSubmit={save}>
      <div className="card-header"><h3>Settings</h3></div>
      <div className="card-body space-y-4">
        <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Rewards points on
        </label>
        <p style={{ ...hint, marginTop: 0 }}>Stores take part by ticking "Rewards" in their Store Settings. The platform pays for points spent.</p>
        <div className="grid grid-cols-3" style={{ gap: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">Points per £1 spent</label>
            <input type="number" className="form-input" min="0" max="100" step="1" value={form.earnPointsPerPound} onChange={(e) => set('earnPointsPerPound', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Value of 1 point (pence)</label>
            <input type="number" className="form-input" min="1" max="100" step="1" value={form.pointValuePence} onChange={(e) => set('pointValuePence', e.target.value)} />
            <p style={hint}>{worth} points = £1</p>
          </div>
          <div className="form-group">
            <label className="form-label">Points expire after (months)</label>
            <input type="number" className="form-input" min="1" max="60" step="1" value={form.expiryMonths} onChange={(e) => set('expiryMonths', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Smallest spend of points</label>
            <input type="number" className="form-input" min="0" step="1" value={form.minRedeemPoints} onChange={(e) => set('minRedeemPoints', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Most points per checkout</label>
            <input type="number" className="form-input" min="0" step="1" value={form.maxRedeemPoints} onChange={(e) => set('maxRedeemPoints', e.target.value)} placeholder="No limit" />
          </div>
          <div className="form-group">
            <label className="form-label">Basket needed to spend points (£)</label>
            <input type="number" className="form-input" min="0" step="0.01" value={form.minBasketToRedeem} onChange={(e) => set('minBasketToRedeem', e.target.value)} placeholder="Any" />
          </div>
        </div>

        <label className="flex items-center cursor-pointer" style={{ gap: '0.5rem', fontWeight: 600, marginTop: 'var(--space-4)' }}>
          <input type="checkbox" checked={form.referralEnabled} onChange={(e) => set('referralEnabled', e.target.checked)} />
          Invite a friend
        </label>
        {form.referralEnabled ? (
          <div className="grid grid-cols-3" style={{ gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Points for the inviter</label>
              <input type="number" className="form-input" min="0" step="1" value={form.referrerPoints} onChange={(e) => set('referrerPoints', e.target.value)} />
              <p style={hint}>Paid when the friend's first order is delivered or collected.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Friend's first-order discount (£)</label>
              <input type="number" className="form-input" min="0" step="0.01" value={form.refereeCouponValue} onChange={(e) => set('refereeCouponValue', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Friend's minimum spend (£)</label>
              <input type="number" className="form-input" min="0" step="0.01" value={form.refereeMinSubtotal} onChange={(e) => set('refereeMinSubtotal', e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save settings'}</button>
        </div>
      </div>
    </form>
  );
}

function LedgerCard() {
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjust, setAdjust] = useState({ email: '', points: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = () =>
    adminService.getLoyaltyLedger({ email: query || undefined, type: type || undefined, page, limit: 20 })
      .then(setData)
      .catch((err) => toast.error(apiMessage(err, 'Failed to load the ledger')));

  useEffect(() => { load(); }, [query, type, page]);

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await adminService.adjustLoyalty({ email: adjust.email.trim(), points: parseInt(adjust.points, 10), note: adjust.note.trim() });
      toast.success('Points adjusted');
      setAdjustOpen(false);
      setAdjust({ email: '', points: '', note: '' });
      load();
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to adjust points'));
    } finally {
      setSaving(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Points ledger</h3>
        <button className="btn btn-sm btn-outline" onClick={() => setAdjustOpen(true)}><Plus size={14} /> Adjust points</button>
      </div>
      {data ? (
        <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          Unspent points: <strong style={{ color: 'var(--text-primary)' }}>{data.outstanding.points.toLocaleString('en-GB')}</strong>
          {' '}(worth {formatCurrency(data.outstanding.value)} if all spent) across {data.outstanding.accounts} customers
        </div>
      ) : null}
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(email.trim()); }}
        style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', flexWrap: 'wrap' }}
      >
        <input className="form-input" style={{ maxWidth: 280, height: 34 }} type="email" placeholder="Customer email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-sm btn-ghost" type="submit"><Search size={14} /> Find</button>
        <select className="form-select" style={{ height: 34, width: 'auto' }} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All entries</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </form>
      {!data ? (
        <div className="card-body"><Skeleton variant="text" width="100%" height="2rem" count={4} /></div>
      ) : data.data.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-8)' }}><h3>No entries</h3></div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>When</th><th>Customer</th><th>Entry</th><th>Order</th><th>Note</th><th className="text-right">Points</th></tr></thead>
            <tbody>
              {data.data.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{formatDateTime(r.createdAt)}</td>
                  <td>{r.user?.name || '—'}<div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.user?.email}</div></td>
                  <td>{TYPE_LABELS[r.type] || r.type}</td>
                  <td>{r.order?.orderNumber || '—'}</td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{r.note}</td>
                  <td className="text-right" style={{ fontWeight: 600, color: r.points < 0 ? '#b91c1c' : '#047857' }}>
                    {r.points > 0 ? `+${r.points}` : r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="flex justify-end" style={{ gap: '0.5rem', padding: 'var(--space-4)' }}>
          <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ alignSelf: 'center', fontSize: 'var(--text-sm)' }}>Page {page} of {pages}</span>
          <button className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust points"
        size="sm"
        footer={
          <div className="flex justify-end" style={{ gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => setAdjustOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="adjust-form" disabled={saving}>{saving ? 'Saving...' : 'Adjust'}</button>
          </div>
        }
      >
        <form id="adjust-form" onSubmit={submitAdjust} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Customer email</label>
            <input className="form-input" type="email" required value={adjust.email} onChange={(e) => setAdjust({ ...adjust, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Points</label>
            <input className="form-input" type="number" step="1" required value={adjust.points} onChange={(e) => setAdjust({ ...adjust, points: e.target.value })} placeholder="e.g. 200, or -50 to remove" />
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <input className="form-input" required minLength={3} maxLength={200} value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} placeholder="Shown on the customer's history" />
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ReferralsCard() {
  const [status, setStatus] = useState('review');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () =>
    adminService.getReferrals({ status: status || undefined, limit: 50 })
      .then(setData)
      .catch((err) => toast.error(apiMessage(err, 'Failed to load referrals')));
  useEffect(() => { load(); }, [status]);

  const review = async (id, action) => {
    try {
      setBusy(id);
      const res = await adminService.reviewReferral(id, { action });
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(apiMessage(err, 'Failed to update the referral'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
        <h3>Referrals</h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="tablist">
          {[['review', 'Needs review'], ['pending', 'Waiting'], ['rewarded', 'Paid'], ['rejected', 'Rejected'], ['', 'All']].map(([k, label]) => (
            <button key={k || 'all'} role="tab" aria-selected={status === k} className={`btn btn-sm ${status === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(k)}>{label}</button>
          ))}
        </div>
      </div>
      {!data ? (
        <div className="card-body"><Skeleton variant="text" width="100%" height="2rem" count={3} /></div>
      ) : data.data.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-8)' }}><h3>Nothing here</h3></div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>Invited by</th><th>Friend</th><th>First order</th><th>Checks</th><th>Status</th><th className="text-right">Points</th>{status === 'review' ? <th className="text-right">Decide</th> : null}</tr></thead>
            <tbody>
              {data.data.map((r) => (
                <tr key={r._id}>
                  <td>{r.referrer?.name}<div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.referrer?.email}</div></td>
                  <td>{r.referee?.name}<div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.referee?.email}</div></td>
                  <td>{r.qualifyingOrder?.orderNumber || '—'}</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: r.flags?.length ? '#b45309' : 'var(--text-secondary)' }}>
                    {r.flags?.length ? r.flags.map((f) => FLAG_LABELS[f] || f).join(', ') : 'None matched'}
                  </td>
                  <td><StatusBadge status={r.status === 'rewarded' ? 'active' : r.status === 'review' ? 'pending' : r.status === 'rejected' ? 'rejected' : 'draft'} label={r.status} size="sm" /></td>
                  <td className="text-right">{r.rewardPoints}</td>
                  {status === 'review' ? (
                    <td className="text-right">
                      <div className="flex justify-end" style={{ gap: '0.375rem' }}>
                        <button className="btn btn-sm btn-success" disabled={busy === r._id} onClick={() => review(r._id, 'approve')}><Check size={14} /> Pay</button>
                        <button className="btn btn-sm btn-outline" disabled={busy === r._id} onClick={() => review(r._id, 'reject')}><X size={14} /> Reject</button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RewardsPage() {
  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader
        title={<span><Gift size={20} style={{ display: 'inline', marginRight: 8 }} />Rewards</span>}
        subtitle="Points customers earn and spend, and friends they invite."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Rewards' }]}
      />
      <SettingsCard />
      <ReferralsCard />
      <LedgerCard />
    </div>
  );
}
