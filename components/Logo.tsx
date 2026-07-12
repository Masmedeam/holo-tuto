export function Logo() {
  return (
    <div className="brand" aria-label="Holo Tutorial">
      <svg className="logo" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="14" fill="currentColor" />
        <path d="M14 15v18M34 15v18M15 24h18" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="34" cy="15" r="3.5" fill="#a99dff" />
      </svg>
      <span>Holo Tutorial</span>
    </div>
  );
}
