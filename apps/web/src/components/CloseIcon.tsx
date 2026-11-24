/** A drawn "remove" mark: two square-cut strokes, in the text colour. */
export function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden focusable="false">
      <path d="M2 2 12 12M12 2 2 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  );
}
