/**
 * <Skeleton> — animated loading placeholder blocks.
 *
 * Props:
 *   variant – 'text' | 'rect' | 'circle' (default 'text')
 *   width   – string | number
 *   height  – string | number
 *   count   – number (repeat skeleton lines, default 1)
 *   style   – CSSProperties
 */
export default function Skeleton({ variant = 'text', width, height, count = 1, style = {} }) {
  const base = {
    borderRadius:
      variant === 'circle'
        ? '50%'
        : variant === 'text'
        ? 'var(--radius-sm)'
        : 'var(--radius-md)',
    width: width || (variant === 'circle' ? 40 : '100%'),
    height:
      height ||
      (variant === 'circle' ? 40 : variant === 'text' ? '0.85em' : 100),
    ...style,
  };

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            ...base,
            marginBottom: count > 1 && i < count - 1 ? 'var(--space-2)' : 0,
          }}
        />
      ))}
    </>
  );
}
