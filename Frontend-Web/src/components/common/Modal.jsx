import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * <Modal> — confirmation dialog / form overlay.
 *
 * Props:
 *   open       – boolean
 *   onClose    – () => void
 *   title      – string
 *   size       – 'sm' | 'md' | 'lg' (default 'md')
 *   footer     – ReactNode (action buttons)
 *   children   – content
 */
export default function Modal({ open, onClose, title, size = 'md', footer, children }) {
  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const widths = { sm: 400, md: 520, lg: 700 };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: widths[size] || widths.md }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close" id="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
