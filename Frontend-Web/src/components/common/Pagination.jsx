import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * <Pagination> — page navigation with first/prev/next/last and info text.
 *
 * Props:
 *   currentPage  – 1-indexed
 *   totalItems   – total record count
 *   pageSize     – items per page
 *   onPageChange – (page) => void
 */
export default function Pagination({ currentPage = 1, totalItems = 0, pageSize = 20, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const to = Math.min(currentPage * pageSize, totalItems);

  const go = (p) => {
    if (p >= 1 && p <= totalPages && p !== currentPage) {
      onPageChange?.(p);
    }
  };

  /* Build visible page numbers (max 7 buttons) */
  const pages = [];
  const maxButtons = 7;
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let end = start + maxButtons - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxButtons + 1);
  }
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{totalItems}</strong>
      </div>

      <div className="pagination-buttons">
        <button
          className="pagination-btn"
          onClick={() => go(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          className="pagination-btn"
          onClick={() => go(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            className={`pagination-btn${p === currentPage ? ' active' : ''}`}
            onClick={() => go(p)}
          >
            {p}
          </button>
        ))}

        <button
          className="pagination-btn"
          onClick={() => go(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          className="pagination-btn"
          onClick={() => go(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
