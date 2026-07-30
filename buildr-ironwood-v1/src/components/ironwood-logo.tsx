export function IronwoodLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? "brand-lockup--compact" : ""}`}>
      <svg className="brand-mark" viewBox="0 0 72 58" aria-hidden="true">
        <path d="M8 29 36 7l28 22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M53 18V8h8v17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <rect x="30" y="29" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M36 29v12M30 35h12" stroke="currentColor" strokeWidth="2" />
      </svg>
      {!compact && (
        <span className="brand-copy">
          <strong>IRONWOOD</strong>
          <small>HOME REMODELING</small>
        </span>
      )}
    </div>
  );
}
