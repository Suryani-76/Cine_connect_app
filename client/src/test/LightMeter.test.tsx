import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LightMeter, Signal } from '../components/ui/LightMeter'

const sampleSignals: Signal[] = [
  { name: 'Skills match', score: 28, maxScore: 30, reason: '4 of 4 skills match' },
  { name: 'Role alignment', score: 20, maxScore: 20, reason: 'Exact role match' },
  { name: 'Experience', score: 14, maxScore: 15, reason: '9 years verified' },
]

describe('LightMeter Signature Component', () => {
  it('renders with role="meter" and correct ARIA attributes', () => {
    render(<LightMeter score={82} label="Test Match" />)

    const meter = screen.getByRole('meter')
    expect(meter).toBeInTheDocument()
    expect(meter).toHaveAttribute('aria-valuenow', '82')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveAttribute('aria-label', 'Match score 82 out of 100')
  })

  it('provides accessible text alternative', () => {
    render(<LightMeter score={82} />)
    expect(screen.getByText('Match score 82 out of 100')).toBeInTheDocument()
  })

  it('clamps scores below 0 to 0 and above 100 to 100', () => {
    const { rerender } = render(<LightMeter score={-15} />)
    let meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '0')

    rerender(<LightMeter score={125} />)
    meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '100')
  })

  it('renders score label in tabular numbers', () => {
    render(<LightMeter score={75} showScoreLabel={true} />)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('/ 100')).toBeInTheDocument()
  })

  it('renders signal breakdown toggle and expands signal details', () => {
    render(<LightMeter score={82} breakdown={sampleSignals} expandable={true} />)

    // Toggle button should be present
    const toggleBtn = screen.getByRole('button', { name: /toggle match signals breakdown/i })
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    // Click to expand
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    // Breakdown details should be visible
    expect(screen.getByTestId('signals-breakdown')).toBeInTheDocument()
    expect(screen.getByText('Skills match')).toBeInTheDocument()
    expect(screen.getByText('4 of 4 skills match')).toBeInTheDocument()
    expect(screen.getByText('Role alignment')).toBeInTheDocument()
  })

  it('renders different sizes without error', () => {
    const { rerender, container } = render(<LightMeter score={50} size="sm" />)
    expect(container.querySelector('[role="meter"]')).toHaveClass('h-4')

    rerender(<LightMeter score={50} size="md" />)
    expect(container.querySelector('[role="meter"]')).toHaveClass('h-6')

    rerender(<LightMeter score={50} size="lg" />)
    expect(container.querySelector('[role="meter"]')).toHaveClass('h-8')
  })

  it('renders scale tick marks including the major tick at 50 with high contrast', () => {
    const { container } = render(<LightMeter score={50} size="md" />)
    const tick50 = container.querySelector('[data-tick-score="50"]')
    expect(tick50).toBeInTheDocument()
    expect(tick50).toHaveClass('bg-ink')
    expect(tick50).toHaveClass('h-4.5')

    // Major ticks at 0, 25, 50, 75, 100 should all have major tick height and bg-ink
    const majorTicks = [0, 25, 50, 75, 100].map(s => container.querySelector(`[data-tick-score="${s}"]`))
    majorTicks.forEach(tick => {
      expect(tick).toBeInTheDocument()
      expect(tick).toHaveClass('bg-ink')
      expect(tick).toHaveClass('h-4.5')
    })
  })
})
