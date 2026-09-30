import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

// ── Lazy-loaded pages (Task 5 — code splitting) ───────────────
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
const NotFound      = lazy(() => import('./pages/NotFound'))

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
            border: '1px solid #E2E8F0',
            color: '#1A1A2E',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            boxShadow: '0 4px 16px rgba(11,37,69,0.10)',
          },
        }}
      />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public ── */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify"   element={<Verify />} />

            {/* ── Onboarding ── */}
            <Route path="/create-profile" element={
              <ProtectedRoute><CreateProfile /></ProtectedRoute>
            } />

            {/* ── App (authenticated) ── */}
            <Route path="/home" element={
              <ProtectedRoute><Home /></ProtectedRoute>
            } />
            <Route path="/search" element={
              <ProtectedRoute><Search /></ProtectedRoute>
            } />
            <Route path="/jobs/create" element={
              <ProtectedRoute><CreateJob /></ProtectedRoute>
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
            <Route path="/profile/:id" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />

            {/* ── Defaults ── */}
            <Route path="/"   element={<Navigate to="/home" replace />} />
            <Route path="*"   element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
