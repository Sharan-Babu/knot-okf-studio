import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  return <span className={cn('badge', className)} {...props} />
}
