import { useEffect, useRef } from 'react';
import { X, ImagePlus, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { IMAGE_ACCEPT, MAX_IMAGES_PER_UPLOAD, MAX_PRODUCT_IMAGES } from '../../utils/constants';

const MAX_BYTES = 5 * 1024 * 1024;

const thumbStyle = {
  position: 'relative',
  width: 84,
  height: 84,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  overflow: 'hidden',
  flexShrink: 0,
  background: 'var(--gray-100)',
};

const iconBtnStyle = {
  position: 'absolute',
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  background: 'rgba(15, 23, 42, 0.72)',
  color: '#fff',
  padding: 0,
};

/**
 * Photo manager for the product form.
 *
 * `kept` are URLs already saved on the product (first = main photo).
 * `added` are { file, preview } entries waiting to upload; they are saved
 * after the kept photos.
 */
export default function ProductImageManager({ kept, added, onChange, disabled }) {
  const inputRef = useRef(null);
  const total = kept.length + added.length;

  // Release preview URLs when the form closes
  const addedRef = useRef(added);
  addedRef.current = added;
  useEffect(() => () => addedRef.current.forEach((a) => URL.revokeObjectURL(a.preview)), []);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const accepted = [];
    for (const file of files) {
      if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG, WebP or GIF`);
      } else if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 5 MB`);
      } else {
        accepted.push(file);
      }
    }
    const room = Math.min(MAX_PRODUCT_IMAGES - total, MAX_IMAGES_PER_UPLOAD - added.length);
    if (accepted.length > room) {
      toast.error(room > 0 ? `You can add ${room} more photo${room === 1 ? '' : 's'} now` : 'Photo limit reached');
    }
    const next = accepted.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (next.length) onChange({ kept, added: [...added, ...next] });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeKept = (url) => onChange({ kept: kept.filter((u) => u !== url), added });
  const makeMain = (url) => onChange({ kept: [url, ...kept.filter((u) => u !== url)], added });
  const removeAdded = (entry) => {
    URL.revokeObjectURL(entry.preview);
    onChange({ kept, added: added.filter((a) => a !== entry) });
  };

  return (
    <div className="form-group">
      <label className="form-label">Product Photos</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {kept.map((url, i) => (
          <div key={url} style={thumbStyle}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {i === 0 ? (
              <span className="badge badge-primary badge-sm" style={{ position: 'absolute', left: 4, bottom: 4 }}>Main</span>
            ) : (
              <button type="button" style={{ ...iconBtnStyle, left: 4, bottom: 4 }} onClick={() => makeMain(url)} title="Make main photo" disabled={disabled}>
                <Star size={12} />
              </button>
            )}
            <button type="button" style={{ ...iconBtnStyle, top: 4, right: 4 }} onClick={() => removeKept(url)} title="Remove photo" disabled={disabled}>
              <X size={12} />
            </button>
          </div>
        ))}
        {added.map((entry, i) => (
          <div key={entry.preview} style={{ ...thumbStyle, borderStyle: 'dashed' }}>
            <img src={entry.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
            {kept.length === 0 && i === 0 && (
              <span className="badge badge-primary badge-sm" style={{ position: 'absolute', left: 4, bottom: 4 }}>Main</span>
            )}
            <button type="button" style={{ ...iconBtnStyle, top: 4, right: 4 }} onClick={() => removeAdded(entry)} title="Remove photo" disabled={disabled}>
              <X size={12} />
            </button>
          </div>
        ))}
        {total < MAX_PRODUCT_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            style={{
              ...thumbStyle,
              borderStyle: 'dashed',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: 'var(--gray-500)',
              fontSize: 'var(--text-xs)',
            }}
          >
            <ImagePlus size={20} />
            Add
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <span className="form-help">
        Up to {MAX_PRODUCT_IMAGES} photos (add {MAX_IMAGES_PER_UPLOAD} at a time), 5 MB each. The first photo is shown in your shop.
      </span>
    </div>
  );
}
