import { useState, useEffect } from 'react';
import { vendorService } from '../../../api/vendorService';
import { PageHeader, Skeleton } from '../../../components/common';
import toast from 'react-hot-toast';
import { Clock, Copy, CheckCircle2, XCircle } from 'lucide-react';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/* ── Toggle Switch ──────────────────────────────────────────────────── */
function ToggleSwitch({ checked, onChange, id }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 42,
        height: 22,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        cursor: 'pointer',
        background: checked ? '#10b981' : '#d1d5db',
        transition: 'background var(--transition-base)',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--transition-base)',
        }}
      />
    </button>
  );
}

/* ── Operating Hours Skeleton ───────────────────────────────────────── */
function HoursSkeleton() {
  return (
    <div className="animate-slide-up">
      <PageHeader title="Operating Hours" subtitle="Set your weekly store schedule." />
      <div className="card" style={{ maxWidth: '800px' }}>
        <div className="card-body">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <Skeleton variant="text" width={100} height="1rem" />
              <Skeleton variant="rect" width={42} height={22} style={{ borderRadius: 'var(--radius-full)' }} />
              <Skeleton variant="text" width={80} height="1.5rem" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Live Status Badge ──────────────────────────────────────────────── */
function LiveStatusBadge({ hours }) {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentDay = hours[dayName];

  if (!currentDay?.isOpen) {
    return (
      <span className="badge badge-danger">
        <XCircle size={12} />
        Currently Closed
      </span>
    );
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = (currentDay.openTime || '09:00').split(':').map(Number);
  const [closeH, closeM] = (currentDay.closeTime || '17:00').split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;

  return (
    <span className={`badge ${isOpen ? 'badge-success' : 'badge-warning'}`}>
      {isOpen ? <CheckCircle2 size={12} /> : <Clock size={12} />}
      {isOpen ? 'Currently Open' : 'Opens Later Today'}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function OperatingHoursPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState({});

  useEffect(() => {
    fetchHours();
  }, []);

  const fetchHours = async () => {
    try {
      setLoading(true);
      const data = await vendorService.getOperatingHours();
      const initialHours = {};
      DAYS_OF_WEEK.forEach((day) => {
        initialHours[day] = data[day] || { isOpen: false, openTime: '09:00', closeTime: '17:00' };
      });
      setHours(initialHours);
    } catch (error) {
      toast.error('Failed to load operating hours');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (day) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], isOpen: !prev[day].isOpen },
    }));
  };

  const handleChangeTime = (day, field, value) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const copyToAll = (sourceDay) => {
    const source = hours[sourceDay];
    if (!source) return;
    setHours((prev) => {
      const next = { ...prev };
      DAYS_OF_WEEK.forEach((day) => {
        next[day] = { ...source };
      });
      return next;
    });
    toast.success(`Copied ${sourceDay}'s schedule to all days`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorService.updateOperatingHours(hours);
      toast.success('Operating hours updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update operating hours');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <HoursSkeleton />;

  const openDays = DAYS_OF_WEEK.filter((d) => hours[d]?.isOpen).length;

  return (
    <div className="animate-slide-up">
      <PageHeader
        title="Operating Hours"
        subtitle="Set your weekly store schedule."
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Operating Hours' },
        ]}
        actions={<LiveStatusBadge hours={hours} />}
      />

      {/* ── Summary Banner ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-5)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-50)',
          border: '1px solid var(--border-color)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{openDays}</strong> of 7 days open
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {DAYS_OF_WEEK.map((day) => (
            <span
              key={day}
              title={day}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hours[day]?.isOpen ? '#10b981' : '#d1d5db',
                transition: 'background var(--transition-base)',
              }}
            />
          ))}
        </span>
      </div>

      <div className="card" style={{ maxWidth: '800px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div>
              {DAYS_OF_WEEK.map((day, idx) => (
                <div
                  key={day}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 0',
                    borderBottom: idx < DAYS_OF_WEEK.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  {/* Day Name */}
                  <div style={{
                    width: 110,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    fontSize: 'var(--text-md)',
                    color: hours[day]?.isOpen ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}>
                    {day}
                  </div>

                  {/* Toggle */}
                  <ToggleSwitch
                    checked={hours[day]?.isOpen}
                    onChange={() => handleToggle(day)}
                    id={`toggle-${day}`}
                  />

                  {/* Status Label */}
                  <span style={{
                    width: 50,
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: hours[day]?.isOpen ? '#10b981' : 'var(--text-tertiary)',
                  }}>
                    {hours[day]?.isOpen ? 'Open' : 'Closed'}
                  </span>

                  {/* Time Inputs */}
                  {hours[day]?.isOpen && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <input
                        type="time"
                        className="form-input"
                        style={{ width: 120, fontSize: 'var(--text-sm)' }}
                        value={hours[day]?.openTime || '09:00'}
                        onChange={(e) => handleChangeTime(day, 'openTime', e.target.value)}
                        required
                        id={`open-${day}`}
                      />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>to</span>
                      <input
                        type="time"
                        className="form-input"
                        style={{ width: 120, fontSize: 'var(--text-sm)' }}
                        value={hours[day]?.closeTime || '17:00'}
                        onChange={(e) => handleChangeTime(day, 'closeTime', e.target.value)}
                        required
                        id={`close-${day}`}
                      />
                    </div>
                  )}

                  {/* Copy to All */}
                  {hours[day]?.isOpen && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyToAll(day)}
                      title={`Copy ${day}'s hours to all days`}
                      style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}
                    >
                      <Copy size={13} />
                      Copy to all
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ paddingTop: 'var(--space-5)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving} id="save-hours-btn">
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
