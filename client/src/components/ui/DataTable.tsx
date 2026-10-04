import { forwardRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export const DataTable = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className = '', ...props }, ref) => (
    <div className="w-full overflow-x-auto border border-line rounded-sm bg-surface">
      <table ref={ref} className={`w-full text-left text-14 text-ink border-collapse ${className}`} {...props} />
    </div>
  )
)
DataTable.displayName = 'DataTable'

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <thead ref={ref} className={`border-b border-line bg-paper/60 text-12 font-semibold text-muted select-none ${className}`} {...props} />
  )
)
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={`divide-y divide-line ${className}`} {...props} />
  )
)
TableBody.displayName = 'TableBody'

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => (
    <tr
      ref={ref}
      className={`transition-colors hover:bg-paper/40 ${className}`}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <th
      ref={ref}
      className={`py-2.5 px-3 font-semibold text-muted text-12 ${className}`}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td
      ref={ref}
      className={`py-2.5 px-3 text-14 text-ink align-middle tnum ${className}`}
      {...props}
    />
  )
)
TableCell.displayName = 'TableCell'

export interface DataRowProps extends HTMLAttributes<HTMLDivElement> {
  clickable?: boolean
}

export const DataRow = forwardRef<HTMLDivElement, DataRowProps>(
  ({ clickable = false, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`flex items-center justify-between p-3 border border-line bg-surface rounded-sm transition-colors ${clickable ? 'cursor-pointer hover:border-ink hover:bg-paper/30' : ''} ${className}`}
      {...props}
    />
  )
)
DataRow.displayName = 'DataRow'
