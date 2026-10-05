import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          className="max-w-xl mx-auto my-12 p-6 bg-surface border border-line rounded-sm space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-3 text-status-error">
            <div className="w-8 h-8 rounded-sm bg-status-error/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-18 font-bold text-ink">This page could not be displayed</h2>
              <p className="text-12 text-muted">A technical error prevented this section from rendering.</p>
            </div>
          </div>

          <p className="text-14 text-muted bg-paper p-3 rounded-sm border border-line font-mono text-12 overflow-x-auto">
            {this.state.error?.message || 'An unexpected runtime error occurred.'}
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={this.handleRetry}
            >
              <RefreshCw size={14} />
              <span>Try again</span>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
