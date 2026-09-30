import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Film } from 'lucide-react'

const NotFound = () => {
  useEffect(() => { document.title = '404 — Page not found | CineConnect' }, [])
  return (
    <div className="min-h-screen bg-surface-section flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 mb-6">
          <Film size={28} className="text-brand" />
        </div>
        <p className="mono-text text-7xl font-bold text-surface-subtle mb-2">404</p>
        <h1 className="text-2xl font-bold text-content-heading mb-2">Page not found</h1>
        <p className="text-sm text-content-tertiary mb-8">
          The page you're looking for doesn't exist or was moved.
        </p>
        <Link to="/home" className="btn-primary">← Back to home</Link>
      </div>
    </div>
  )
}

export default NotFound
