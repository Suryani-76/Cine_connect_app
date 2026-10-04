import { Button } from './Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  itemsPerPage?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 10,
  className = '',
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = totalItems ? Math.min(currentPage * itemsPerPage, totalItems) : currentPage * itemsPerPage

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 py-3 text-14 text-muted select-none ${className}`}
    >
      <div className="tnum">
        {totalItems ? (
          <span>
            Showing <strong className="text-ink">{startItem}–{endItem}</strong> of{' '}
            <strong className="text-ink">{totalItems}</strong> items
          </span>
        ) : (
          <span>
            Page <strong className="text-ink">{currentPage}</strong> of{' '}
            <strong className="text-ink">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="inline-flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </Button>

        <span className="px-2 text-12 font-medium text-ink tnum">
          {currentPage} / {totalPages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}

export interface LoadMoreProps {
  onLoadMore: () => void
  loading?: boolean
  hasMore: boolean
  totalItems?: number
  currentCount?: number
  className?: string
}

export function LoadMore({
  onLoadMore,
  loading = false,
  hasMore,
  totalItems,
  currentCount,
  className = '',
}: LoadMoreProps) {
  if (!hasMore && (!totalItems || !currentCount || currentCount >= totalItems)) {
    return (
      <div className={`text-center py-4 text-12 text-muted select-none ${className}`}>
        {totalItems ? `All ${totalItems} items loaded` : 'End of list'}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-4 ${className}`}>
      {totalItems && currentCount && (
        <span className="text-12 text-muted tnum">
          Showing {currentCount} of {totalItems}
        </span>
      )}
      <Button
        variant="secondary"
        size="md"
        loading={loading}
        onClick={onLoadMore}
      >
        Load more
      </Button>
    </div>
  )
}
