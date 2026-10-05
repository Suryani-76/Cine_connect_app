import { Link } from "react-router-dom"
import { Film } from "lucide-react"

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full border-t border-line bg-surface mt-auto py-8 text-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-tungsten flex items-center justify-center text-ink shrink-0">
              <Film size={14} />
            </div>
            <span className="brand-text text-16 font-bold tracking-tight text-ink">
              CINECONNECT
            </span>
            <span className="text-12 text-muted ml-2">
              © {currentYear} CineConnect. All rights reserved.
            </span>
          </div>

          {/* Legal and Support Links */}
          <nav aria-label="Legal and Support" className="flex flex-wrap items-center justify-center gap-6 text-12 text-muted">
            <Link to="/terms" className="hover:text-ink transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-ink transition-colors">
              Privacy Policy
            </Link>
            <Link to="/cookies" className="hover:text-ink transition-colors">
              Cookie Policy
            </Link>
            <Link to="/contact" className="hover:text-ink transition-colors">
              Grievance & Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
