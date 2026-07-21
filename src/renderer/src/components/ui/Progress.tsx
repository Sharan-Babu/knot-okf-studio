export function Progress({ value, tone = 'violet' }: { value: number; tone?: 'violet' | 'green' | 'amber' }): React.JSX.Element {
  const bounded = Math.max(0, Math.min(100, value))
  return <div className="progress-track" role="progressbar" aria-label={`${value}% complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}><span className={`progress-value progress-${tone}`} style={{ width: `${bounded}%` }} /></div>
}
