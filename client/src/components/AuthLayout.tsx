import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: ReactNode
  productContext: string
  contextSubtitle?: string
}

export function AuthLayout({
  children,
  productContext,
  contextSubtitle = 'Production match engine',
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      {/* ── Accessible Skip to Content Link ── */}
      <a
        href="#auth-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-surface focus:rounded-sm focus:outline-none text-14 font-semibold"
      >
        Skip to content
      </a>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        {/* ── Left Column: Form & Actions ── */}
        <main
          id="auth-content"
          className="lg:col-span-7 xl:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-surface"
        >
          {/* Top Brand Header */}
          <div className="flex items-center justify-between mb-8 sm:mb-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 focus:outline-none focus:ring-1 focus:ring-ink rounded-sm"
              aria-label="CineConnect home"
            >
              {/* Logo icon square: Amber/Tungsten fill */}
              <div className="w-8 h-8 rounded-[3px] bg-tungsten flex items-center justify-center shrink-0 shadow-xs">
                <span className="font-extrabold text-ink text-16 tracking-tighter select-none font-sans">
                  CC
                </span>
              </div>
              {/* Full wordmark CineConnect: Ink */}
              <span className="brand-text text-18 font-bold tracking-tight text-ink font-sans">
                <span>Cine</span><span>Connect</span>
              </span>
            </Link>

            <Link
              to="/"
              className="text-12 text-muted hover:text-ink transition-colors font-medium"
            >
              Back to overview
            </Link>
          </div>

          {/* Form Container */}
          <div className="w-full max-w-md mx-auto my-auto py-4">
            {children}
          </div>

          {/* Bottom Legal Links */}
          <footer className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-4 text-12 text-muted">
            <p>© {new Date().getFullYear()} CineConnect. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-ink transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-ink transition-colors">
                Privacy
              </Link>
              <Link to="/contact" className="hover:text-ink transition-colors">
                Contact
              </Link>
            </div>
          </footer>
        </main>

        {/* ── Right Column: Quiet Ink Panel (Desktop Only) ── */}
        <aside
          className="hidden lg:flex lg:col-span-5 xl:col-span-6 bg-ink text-surface flex-col justify-between p-12 lg:p-16 select-none relative overflow-hidden"
          aria-hidden="true"
        >
          {/* Subtle Film Grain / Grid Background Accents */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Top Header in Panel */}
          <div className="relative z-10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tungsten inline-block" />
            <span className="text-12 font-mono tracking-wider text-surface/60">
              {contextSubtitle}
            </span>
          </div>

          {/* Center Product Context (One line of real product context, not a testimonial) */}
          <div className="relative z-10 max-w-lg my-auto space-y-6">
            <blockquote className="text-28 xl:text-32 font-bold text-surface tracking-tight leading-tight">
              {productContext}
            </blockquote>

            <div className="pt-6 border-t border-surface/10 flex items-center gap-4 text-12 text-surface/60 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-gel-camera inline-block" />
                Camera
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-gel-sound inline-block" />
                Sound
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-gel-editing inline-block" />
                Editing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-gel-art inline-block" />
                Art
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-gel-cast inline-block" />
                Cast
              </span>
            </div>
          </div>

          {/* Bottom Call Sheet / Set Note */}
          <div className="relative z-10 text-12 text-surface/40 font-mono flex items-center justify-between">
            <span>Verified industry roster</span>
            <span>Production grade</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
