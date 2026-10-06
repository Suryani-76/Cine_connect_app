import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { ScrollToTop } from './components/ScrollToTop'

// ── Lazy-loaded pages ─────────────────────────────────────────
const Login         = lazy(() => import('./pages/Login'))
const Register      = lazy(() => import('./pages/Register'))
const Verify        = lazy(() => import('./pages/Verify'))
const CreateProfile = lazy(() => import('./pages/CreateProfile'))
const Home          = lazy(() => import('./pages/Home'))
const Search        = lazy(() => import('./pages/Search'))
const CreateJob     = lazy(() => import('./pages/CreateJob'))
const Applications  = lazy(() => import('./pages/Applications'))
const Chat          = lazy(() => import('./pages/Chat'))
const Profile       = lazy(() => import('./pages/Profile'))
const JobDetail     = lazy(() => import('./pages/JobDetail'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NotFound      = lazy(() => import('./pages/NotFound'))
const Settings      = lazy(() => import('./pages/Settings'))
const Admin         = lazy(() => import('./pages/Admin'))

// Legal & Compliance pages (Step 3.1)
const Privacy       = lazy(() => import('./pages/Privacy'))
const Terms         = lazy(() => import('./pages/Terms'))
const Cookies       = lazy(() => import('./pages/Cookies'))
const Contact       = lazy(() => import('./pages/Contact'))
const Unsubscribe   = lazy(() => import('./pages/Unsubscribe'))

// Milestone M2 pages
import Landing from './pages/Landing'
const BrowseJobs    = lazy(() => import('./pages/BrowseJobs'))
const SavedJobs     = lazy(() => import('./pages/SavedJobs'))
const Alerts        = lazy(() => import('./pages/Alerts'))
const EditJob       = lazy(() => import('./pages/EditJob'))
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'))
const AuditComponents = lazy(() => import('./pages/AuditComponents'))
const DesignShowcase = lazy(() => import('./pages/DesignShowcase'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid #D5DBE3',
            color: '#0E1B2E',
            fontFamily: 'Archivo, sans-serif',
            fontSize: '14px',
            boxShadow: '0 4px 16px rgba(14,27,46,0.10)',
          },
        }}
      />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── App Shell Layout (Signed In Rail or Public Topbar/Footer) ── */}
            <Route element={<AppShell />}>
              {/* ── Public Auth ── */}
              <Route path="/login"          element={<Login />} />
              <Route path="/register"       element={<Register />} />
              <Route path="/verify"         element={<Verify />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* ── Legal & Contact (Public) ── */}
              <Route path="/privacy"        element={<Privacy />} />
              <Route path="/terms"          element={<Terms />} />
              <Route path="/cookies"        element={<Cookies />} />
              <Route path="/contact"        element={<Contact />} />
              <Route path="/unsubscribe/:token" element={<Unsubscribe />} />

              {/* ── Onboarding ── */}
              <Route path="/create-profile" element={
                <ProtectedRoute><CreateProfile /></ProtectedRoute>
              } />

              {/* ── Public Marketplace & Directory ── */}
              <Route path="/jobs" element={<BrowseJobs />} />
              <Route path="/company/:id" element={<CompanyDetail />} />

              {/* ── App (authenticated) ── */}
              <Route path="/home" element={
                <ProtectedRoute><Home /></ProtectedRoute>
              } />
              <Route path="/search" element={
                <ProtectedRoute><Search /></ProtectedRoute>
              } />
              <Route path="/jobs/create" element={
                <ProtectedRoute allowedRoles={['production']}><CreateJob /></ProtectedRoute>
              } />
              <Route path="/jobs/:id/edit" element={
                <ProtectedRoute allowedRoles={['production']}><EditJob /></ProtectedRoute>
              } />
              <Route path="/jobs/:id" element={
                <ProtectedRoute><JobDetail /></ProtectedRoute>
              } />
              <Route path="/saved-jobs" element={
                <ProtectedRoute allowedRoles={['talent']}><SavedJobs /></ProtectedRoute>
              } />
              <Route path="/alerts" element={
                <ProtectedRoute allowedRoles={['production']}><Alerts /></ProtectedRoute>
              } />
              <Route path="/applications" element={
                <ProtectedRoute><Applications /></ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute><Chat /></ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute><Profile /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><Settings /></ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute><Admin /></ProtectedRoute>
              } />
              <Route path="/profile/:id" element={
                <ProtectedRoute><Profile /></ProtectedRoute>
              } />

              {/* ── Defaults ── */}
              <Route path="/audit-components" element={<AuditComponents />} />
              <Route path="/"   element={<Landing />} />
              <Route path="*"   element={<NotFound />} />
            </Route>

            {/* ── Design System (DEV only, standalone without AppShell) ── */}
            {import.meta.env.DEV && (
              <Route path="/design" element={<DesignShowcase />} />
            )}
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
