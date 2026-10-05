import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  className?: string
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`space-y-3 pb-6 border-b border-line ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumbs">
          <ol className="flex items-center gap-1.5 text-12 text-muted">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <li key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && (
                    <ChevronRight size={12} className="text-muted/60 shrink-0" aria-hidden="true" />
                  )}
                  {isLast || !crumb.href ? (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={`truncate max-w-[200px] sm:max-w-xs ${
                        isLast ? 'text-ink font-semibold' : 'text-muted'
                      }`}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.href}
                      className="hover:text-ink transition-colors truncate max-w-[150px] sm:max-w-xs"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-28 font-bold text-ink tracking-tight font-sans leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-14 text-muted max-w-2xl leading-normal">
              {description}
            </p>
          )}
        </div>

        {action && (
          <div className="flex items-center gap-3 shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
