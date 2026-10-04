import * as TabsPrimitive from '@radix-ui/react-tabs'
import { forwardRef, ComponentPropsWithoutRef, ElementRef } from 'react'

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className = '', ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={`inline-flex items-center gap-1 border-b border-line w-full ${className}`}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className = '', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={`inline-flex items-center justify-center whitespace-nowrap px-3.5 py-2 text-14 font-medium transition-all border-b-2 -mb-[1px] select-none text-muted border-transparent hover:text-ink hover:border-line/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink data-[state=active]:border-ink data-[state=active]:text-ink data-[state=active]:font-semibold disabled:pointer-events-none disabled:opacity-50 ${className}`}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className = '', ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={`mt-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink ${className}`}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
