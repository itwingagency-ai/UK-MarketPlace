import { Link } from 'react-router-dom';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

/**
 * Shown when a customer logs in whose vendor application is still pending.
 * They cannot access the portal until the super admin approves.
 */
export default function ApplicationPendingPage({ status = 'pending', storeName = '' }) {
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  return (
    <div className="auth-layout">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-card-header">
          <h2>
            {isPending
              ? 'Application Under Review'
              : isRejected
              ? 'Application Rejected'
              : 'Application Status'}
          </h2>
        </div>

        <div className="auth-card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: isPending ? '#fff3e0' : isRejected ? '#ffebee' : '#e8f5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            {isPending && <Clock size={28} color="#e65100" />}
            {isRejected && <XCircle size={28} color="#c62828" />}
            {!isPending && !isRejected && <CheckCircle size={28} color="#5B9F12" />}
          </div>

          {isPending && (
            <>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Awaiting Admin Approval</h3>
              <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
                Your vendor application{storeName ? ` for "${storeName}"` : ''} is currently being
                reviewed by the platform administrator. You will receive an email notification once
                your application has been approved.
              </p>
              <p
                style={{
                  color: 'var(--gray-500)',
                  fontSize: 'var(--text-sm)',
                  marginTop: 'var(--space-4)',
                }}
              >
                You cannot access the vendor portal until your application is approved.
              </p>
            </>
          )}

          {isRejected && (
            <>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Application Not Approved</h3>
              <p style={{ color: 'var(--gray-600)', lineHeight: 1.6 }}>
                Unfortunately, your vendor application was not approved at this time. Please contact
                the platform administrator for more information or to submit a new application.
              </p>
            </>
          )}

          <Link
            to="/login"
            className="btn btn-ghost"
            style={{ marginTop: 'var(--space-6)' }}
            onClick={() => {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
            }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
