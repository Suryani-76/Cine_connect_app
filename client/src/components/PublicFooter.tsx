import { Link } from "react-router-dom"
import { Film } from "lucide-react"

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full border-t border-surface-border bg-white mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-navy flex items-center justify-center">
              <Film size={14} className="text-white" />
            </div>
            <span className="brand-text text-base text-brand-navy">
              Cine<span className="text-brand">Connect</span>
            </span>
            <span className="text-xs text-content-tertiary ml-2">
              © {currentYear} CineConnect. All rights reserved.
            </span>
          </div>

          {/* Legal and Support Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-content-secondary">
            <Link to="/terms" className="hover:text-brand transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-brand transition-colors">
              Privacy Policy
            </Link>
            <Link to="/cookies" className="hover:text-brand transition-colors">
              Cookie Policy
            </Link>
            <Link to="/contact" className="hover:text-brand transition-colors">
              Grievance & Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
