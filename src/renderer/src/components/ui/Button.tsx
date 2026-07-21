import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva('button', {
  variants: {
    variant: {
      primary: 'button-primary',
      secondary: 'button-secondary',
      ghost: 'button-ghost',
      danger: 'button-danger'
    },
    size: {
      sm: 'button-sm',
      md: 'button-md',
      lg: 'button-lg',
      icon: 'button-icon'
    }
  },
  defaultVariants: { variant: 'secondary', size: 'md' }
})

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Component = asChild ? Slot : 'button'
  return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})

Button.displayName = 'Button'
