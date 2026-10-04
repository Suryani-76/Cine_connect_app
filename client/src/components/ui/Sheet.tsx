import * as DialogPrimitive from '@radix-ui/react-dialog'
import { forwardRef, ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import { X } from 'lucide-react'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetPortal = DialogPrimitive.Portal

export const SheetOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${className}`}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

export interface SheetContentProps
  extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'title'> {
  side?: 'top' | 'bottom' | 'left' | 'right'
  title?: ReactNode
  description?: ReactNode
}

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className = '', title, description, children, ...props }, ref) => {
  const sideClasses = {
    top: 'inset-x-0 top-0 border-b border-line rounded-b-lg data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
    bottom: 'inset-x-0 bottom-0 border-t border-line rounded-t-lg data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom max-h-[85vh]',
    left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r border-line rounded-r-lg data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l border-line rounded-l-lg data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  }[side]

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={`fixed z-50 bg-surface p-6 shadow-floating transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 focus-visible:outline-none overflow-y-auto ${sideClasses} ${className}`}
        {...props}
      >
        <div className="flex flex-col gap-1 mb-4">
          {title && (
            <DialogPrimitive.Title className="text-18 font-bold text-ink leading-tight">
              {title}
            </DialogPrimitive.Title>
          )}
          {description && (
            <DialogPrimitive.Description className="text-14 text-muted leading-normal">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>

        {children}

        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-sm p-1 text-muted hover:text-ink hover:bg-paper transition-colors focus:outline-none focus:ring-1 focus:ring-ink"
          aria-label="Close sheet"
        >
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = DialogPrimitive.Content.displayName
