import { initials } from '@/lib/utils'

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  return <span className={`avatar avatar-${size}`} style={{ '--avatar-color': color ?? '#6f62cf' } as React.CSSProperties}>{initials(name)}</span>
}
