import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="error-page">
      <div>
        <div className="error-page-code">404</div>
        <h2>Page Not Found</h2>
        <p>
          The page you're looking for doesn't exist or has been moved. Please
          check the URL and try again.
        </p>
        <Link to="/" className="btn btn-primary" id="notfound-home-btn">
          <FileQuestion size={16} />
          Go Home
        </Link>
      </div>
    </div>
  );
}
