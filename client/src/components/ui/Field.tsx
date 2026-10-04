import { ReactNode } from 'react'

export interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className = '',
  children,
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-14 font-medium text-ink flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-status-error ml-1" aria-hidden="true">*</span>}
          </span>
        </label>
      )}

      {children}

      {hint && !error && (
        <p className="text-12 text-muted leading-tight">{hint}</p>
      )}

      {error && (
        <p className="text-12 text-status-error font-medium leading-tight" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
