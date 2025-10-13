import * as React from 'react'

import { cn } from '@/lib/utils'

function hasMessageProperty(value: unknown): value is { message?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, 'message')
  )
}

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  'data-invalid'?: boolean
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = 'vertical', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'space-y-2',
          orientation === 'horizontal' &&
            'flex items-center justify-between space-x-4 space-y-0',
          orientation === 'responsive' &&
            'sm:flex sm:items-center sm:justify-between sm:space-x-4 sm:space-y-0',
          props['data-invalid'] && 'text-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Field.displayName = 'Field'

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'space-y-6',
      props['data-slot'] === 'checkbox-group' && 'space-y-3',
      className,
    )}
    {...props}
  />
))
FieldGroup.displayName = 'FieldGroup'

const FieldContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex-1 space-y-1', className)} {...props} />
))
FieldContent.displayName = 'FieldContent'

const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
))
FieldLabel.displayName = 'FieldLabel'

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-[0.8rem] text-muted-foreground', className)}
    {...props}
  />
))
FieldDescription.displayName = 'FieldDescription'

interface FieldErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  errors?: unknown
}

const FieldError = React.forwardRef<HTMLDivElement, FieldErrorProps>(
  ({ className, errors, ...props }, ref) => {
    if (!errors) return null

    // Handle different error formats
    let errorMessages: Array<string> = []

    if (Array.isArray(errors)) {
      errorMessages = errors.map((error) => {
        if (typeof error === 'string') {
          return error
        }

        if (hasMessageProperty(error)) {
          const { message } = error
          return typeof message === 'string' ? message : String(message)
        }

        return String(error)
      })
    } else if (typeof errors === 'string') {
      errorMessages = [errors]
    } else if (hasMessageProperty(errors)) {
      const { message } = errors
      errorMessages = [typeof message === 'string' ? message : String(message)]
    } else {
      errorMessages = [String(errors)]
    }

    if (errorMessages.length === 0) return null

    return (
      <div
        ref={ref}
        className={cn('text-[0.8rem] font-medium text-destructive', className)}
        {...props}
      >
        {errorMessages.join(', ')}
      </div>
    )
  },
)
FieldError.displayName = 'FieldError'

const FieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
  <fieldset ref={ref} className={cn('space-y-4', className)} {...props} />
))
FieldSet.displayName = 'FieldSet'

const FieldLegend = React.forwardRef<
  HTMLLegendElement,
  React.HTMLAttributes<HTMLLegendElement> & {
    variant?: 'default' | 'label'
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <legend
    ref={ref}
    className={cn(
      variant === 'default' && 'text-base font-semibold',
      variant === 'label' && 'text-sm font-medium',
      className,
    )}
    {...props}
  />
))
FieldLegend.displayName = 'FieldLegend'

const FieldTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm font-medium', className)} {...props} />
))
FieldTitle.displayName = 'FieldTitle'

export {
  Field,
  FieldGroup,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldTitle,
}
