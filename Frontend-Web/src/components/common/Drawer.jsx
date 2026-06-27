import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * <Drawer> — slide-in sidebar panel for editing / details.
 *
 * Props:
 *   open       – boolean
 *   onClose    – () => void
 *   title      – string
 *   width      – number | string (default 480)
 *   footer     – ReactNode
 *   children   – content
 */
export default function Drawer({ open, onClose, title, width = 480, footer, children }) {
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

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-panel animate-slide-in"
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close" id="drawer-close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body">{children}</div>

        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
