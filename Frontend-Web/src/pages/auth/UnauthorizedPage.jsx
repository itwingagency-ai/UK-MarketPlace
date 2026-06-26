import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="error-page">
      <div>
        <div className="error-page-code">403</div>
        <h2>Access Denied</h2>
        <p>
          You don't have permission to view this page. If you believe this is an
          error, please contact your administrator.
        </p>
        <Link to="/login" className="btn btn-primary" id="unauthorized-back-btn">
          <ShieldOff size={16} />
          Back to Login
        </Link>
      </div>
    </div>
  );
}
