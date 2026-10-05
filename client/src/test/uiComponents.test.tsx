import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Field,
  Badge,
  DepartmentMark,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Modal,
  ModalTrigger,
  ModalContent,
  Sheet,
  SheetTrigger,
  SheetContent,
  Skeleton,
  EmptyState,
  DataTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  DataRow,
  Avatar,
  Pagination,
  LoadMore,
  Tooltip,
} from '../components/ui'

describe('UI Component Library', () => {
  describe('Button', () => {
    it('renders all variants correctly', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-tungsten')

      rerender(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-surface')

      rerender(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-transparent')

      rerender(<Button variant="danger">Danger</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-status-error/10')
    })

    it('renders loading state with aria-busy and disables interaction', () => {
      const onClick = vi.fn()
      render(<Button loading onClick={onClick}>Loading Action</Button>)
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('aria-busy', 'true')
      expect(btn).toBeDisabled()

      fireEvent.click(btn)
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('Input, Textarea, Select & Checkbox', () => {
    it('renders Input with error state', () => {
      render(<Input placeholder="Type here" error="Invalid input" />)
      const input = screen.getByPlaceholderText('Type here')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveClass('border-status-error')
    })

    it('renders Textarea with rows and error', () => {
      render(<Textarea placeholder="Bio" rows={5} error={true} />)
      const textarea = screen.getByPlaceholderText('Bio')
      expect(textarea).toHaveAttribute('rows', '5')
      expect(textarea).toHaveAttribute('aria-invalid', 'true')
    })

    it('renders Select with options', () => {
      render(
        <Select defaultValue="val2" options={[{ value: 'val1', label: 'One' }, { value: 'val2', label: 'Two' }]} />
      )
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('val2')
    })

    it('renders Checkbox and handles toggle', () => {
      const onChange = vi.fn()
      render(<Checkbox label="Agree to terms" onChange={onChange} />)
      const cb = screen.getByRole('checkbox')
      expect(cb).not.toBeChecked()

      fireEvent.click(cb)
      expect(onChange).toHaveBeenCalled()
    })

    it('shows visible check mark when checked', () => {
      const { container } = render(<Checkbox label="Verified" checked={true} readOnly />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('opacity-100')
    })
  })

  describe('Field', () => {
    it('renders label, required marker, hint, and error with role="alert"', () => {
      const { rerender } = render(
        <Field label="Job title" required hint="Enter full role title">
          <Input id="title" />
        </Field>
      )
      expect(screen.getByText('Job title')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
      expect(screen.getByText('Enter full role title')).toBeInTheDocument()

      rerender(
        <Field label="Job title" required error="Title is required">
          <Input id="title" error="Title is required" />
        </Field>
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Title is required')
    })
  })

  describe('Badge & DepartmentMark', () => {
    it('renders Badge variants', () => {
      render(<Badge variant="tungsten">Open</Badge>)
      expect(screen.getByText('Open')).toHaveClass('bg-tungsten/15')
    })

    it('renders DepartmentMark for film lighting gels', () => {
      const { rerender } = render(<DepartmentMark department="camera" />)
      expect(screen.getByText('Camera')).toBeInTheDocument()

      rerender(<DepartmentMark department="sound" />)
      expect(screen.getByText('Sound')).toBeInTheDocument()

      rerender(<DepartmentMark department="art and costume" />)
      expect(screen.getByText('Art & Costume')).toBeInTheDocument()
    })
  })

  describe('Tabs', () => {
    it('supports tab selection and WAI-ARIA tab pattern', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab One</TabsTrigger>
            <TabsTrigger value="tab2">Tab Two</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Panel One</TabsContent>
          <TabsContent value="tab2">Panel Two</TabsContent>
        </Tabs>
      )

      expect(screen.getByRole('tablist')).toBeInTheDocument()
      const tab1 = screen.getByRole('tab', { name: 'Tab One' })
      const tab2 = screen.getByRole('tab', { name: 'Tab Two' })

      expect(tab1).toHaveAttribute('data-state', 'active')
      expect(screen.getByText('Panel One')).toBeInTheDocument()

      fireEvent.keyDown(tab2, { key: 'Enter', code: 'Enter' })
      expect(tab2).toHaveAttribute('data-state', 'active')
      expect(screen.getByText('Panel Two')).toBeInTheDocument()
    })
  })

  describe('Modal Dialog', () => {
    it('opens on trigger click, displays title, and closes with close button', () => {
      render(
        <Modal>
          <ModalTrigger asChild>
            <Button>Open Modal</Button>
          </ModalTrigger>
          <ModalContent title="Publish Confirmation" description="Are you sure?">
            <div>Modal Body</div>
          </ModalContent>
        </Modal>
      )

      expect(screen.queryByText('Publish Confirmation')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Open Modal' }))
      expect(screen.getByText('Publish Confirmation')).toBeInTheDocument()
      expect(screen.getByText('Modal Body')).toBeInTheDocument()

      const closeBtn = screen.getByRole('button', { name: /close dialog/i })
      fireEvent.click(closeBtn)
      expect(screen.queryByText('Publish Confirmation')).not.toBeInTheDocument()
    })

    it('closes on Escape key press', () => {
      render(
        <Modal>
          <ModalTrigger asChild>
            <Button>Open For Esc</Button>
          </ModalTrigger>
          <ModalContent title="Esc Test">
            <div>Esc Body</div>
          </ModalContent>
        </Modal>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open For Esc' }))
      expect(screen.getByText('Esc Test')).toBeInTheDocument()

      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
      expect(screen.queryByText('Esc Test')).not.toBeInTheDocument()
    })
  })

  describe('Sheet Mobile Drawer', () => {
    it('opens drawer on trigger and displays content', () => {
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button>Open Sheet</Button>
          </SheetTrigger>
          <SheetContent title="Mobile Drawer">
            <div>Drawer Content</div>
          </SheetContent>
        </Sheet>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open Sheet' }))
      expect(screen.getByText('Mobile Drawer')).toBeInTheDocument()
      expect(screen.getByText('Drawer Content')).toBeInTheDocument()
    })
  })

  describe('Skeleton & EmptyState', () => {
    it('renders Skeleton with aria-hidden="true"', () => {
      const { container } = render(<Skeleton variant="rect" />)
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    })

    it('renders EmptyState and triggers action', () => {
      const onAction = vi.fn()
      render(
        <EmptyState
          title="No items found"
          description="Try modifying search criteria"
          actionLabel="Clear filters"
          onAction={onAction}
        />
      )
      expect(screen.getByText('No items found')).toBeInTheDocument()
      expect(screen.getByText('Try modifying search criteria')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(onAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('DataTable & DataRow', () => {
    it('renders table structure and clickable row', () => {
      render(
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cinematographer</TableCell>
            </TableRow>
          </TableBody>
        </DataTable>
      )
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Role')).toBeInTheDocument()
      expect(screen.getByText('Cinematographer')).toBeInTheDocument()
    })

    it('renders DataRow component', () => {
      render(<DataRow clickable>Row Content</DataRow>)
      expect(screen.getByText('Row Content')).toHaveClass('cursor-pointer')
    })
  })

  describe('Avatar', () => {
    it('renders fallback initials when no image is provided', () => {
      render(<Avatar fallback="Dharma Pictures" size="md" />)
      expect(screen.getByText('DP')).toBeInTheDocument()
    })

    it('uses rounded 3px square (rounded-sm) across all sizes', () => {
      const { container, rerender } = render(<Avatar fallback="Test User" size="sm" />)
      expect(container.firstChild).toHaveClass('rounded-sm')

      rerender(<Avatar fallback="Test User" size="md" />)
      expect(container.firstChild).toHaveClass('rounded-sm')

      rerender(<Avatar fallback="Test User" size="lg" />)
      expect(container.firstChild).toHaveClass('rounded-sm')

      rerender(<Avatar fallback="Test User" size="xl" shape="circle" />)
      expect(container.firstChild).toHaveClass('rounded-sm')
    })
  })

  describe('Pagination & LoadMore', () => {
    it('handles pagination navigation and disables boundary buttons', () => {
      const onPageChange = vi.fn()
      render(
        <Pagination
          currentPage={1}
          totalPages={3}
          totalItems={30}
          onPageChange={onPageChange}
        />
      )

      const prevBtn = screen.getByRole('button', { name: /previous page/i })
      const nextBtn = screen.getByRole('button', { name: /next page/i })

      expect(prevBtn).toBeDisabled()
      expect(nextBtn).not.toBeDisabled()

      fireEvent.click(nextBtn)
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('handles LoadMore button click', () => {
      const onLoadMore = vi.fn()
      render(<LoadMore hasMore={true} onLoadMore={onLoadMore} />)

      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })
  })

  describe('Tooltip', () => {
    it('renders trigger element', () => {
      render(
        <Tooltip content="Helper text">
          <button>Hover me</button>
        </Tooltip>
      )
      expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
    })
  })
})
