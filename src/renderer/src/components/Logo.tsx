export function Logo({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="brand" aria-label="Knot">
      <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M9 13.2C9 10.88 10.88 9 13.2 9h13.6c2.32 0 4.2 1.88 4.2 4.2v13.6c0 2.32-1.88 4.2-4.2 4.2H13.2A4.2 4.2 0 0 1 9 26.8V13.2Z" fill="currentColor" opacity=".12" />
        <path d="M14 15.5h5.2c3.2 0 5.8 2.6 5.8 5.8v3.2M26 24.5h-5.2a5.8 5.8 0 0 1-5.8-5.8v-3.2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="14" cy="15.5" r="2.2" fill="currentColor" />
        <circle cx="26" cy="24.5" r="2.2" fill="currentColor" />
      </svg>
      {!compact && <div><strong>Knot</strong><span>Open knowledge studio</span></div>}
    </div>
  )
}
