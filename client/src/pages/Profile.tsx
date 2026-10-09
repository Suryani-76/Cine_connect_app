import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Pencil,
  X,
  ExternalLink,
  MessageCircle,
  Upload,
  Trash2,
  Plus,
  FileText,
  Download,
  Play,
  Loader2,
  MapPin,
  Languages,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  productionApi,
  talentApi,
  CreateTalentProfilePayload,
  TalentCredit,
  TalentAvailability,
} from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { DepartmentMark, resolveDepartment } from '../components/ui/DepartmentMark'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { formatLoadErrorMessage, pluralize } from '../lib/formatters'

// ── Types ─────────────────────────────────────────────────────

interface ProductionData {
  id?: string
  user_id?: string
  type: 'production'
  company_name: string
  bio: string | null
  production_details: string | null
  logo_url: string | null
  verified?: boolean
  created_at?: string
}

interface TalentData {
  id?: string
  user_id?: string
  type: 'talent'
  full_name: string | null
  bio: string | null
  role: string | null
  roles?: string[]
  skills: string[]
  experience_years: number
  language: string | null
  location: string | null
  avatar_url: string | null
  portfolio_url: string | null
  showreel_url?: string | null
  availability?: TalentAvailability
  has_resume?: boolean
  verified?: boolean
  credits?: TalentCredit[]
  email?: string
  phone?: string
}

type ProfileData = ProductionData | TalentData

// ── Showreel Helpers ──────────────────────────────────────────

const ALLOWED_SHOWREEL_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]

export function getShowreelEmbedUrl(urlString: string): { embedUrl: string; host: 'YouTube' | 'Vimeo' } | null {
  if (!urlString || typeof urlString !== 'string') return null
  try {
    const parsed = new URL(urlString.trim())
    const host = parsed.hostname.toLowerCase()
    if (!ALLOWED_SHOWREEL_HOSTS.some(h => host === h || host.endsWith('.' + h))) return null

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0]
      return videoId ? { embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, host: 'YouTube' } : null
    }

    if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'www.youtube-nocookie.com'
    ) {
      if (parsed.pathname.startsWith('/embed/')) {
        const videoId = parsed.pathname.split('/')[2]
        return videoId ? { embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, host: 'YouTube' } : null
      }
      const videoId = parsed.searchParams.get('v')
      return videoId ? { embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, host: 'YouTube' } : null
    }

    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const match = parsed.pathname.match(/^\/(\d+)/)
      return match ? { embedUrl: `https://player.vimeo.com/video/${match[1]}`, host: 'Vimeo' } : null
    }

    if (host === 'player.vimeo.com') {
      const match = parsed.pathname.match(/\/video\/(\d+)/)
      return match ? { embedUrl: `https://player.vimeo.com/video/${match[1]}`, host: 'Vimeo' } : null
    }

    return null
  } catch {
    return null
  }
}

// ── Profile Strength Calculation ──────────────────────────────

export function calculateProfileStrength(talent: TalentData): {
  score: number
  topMissingRecommendation: string | null
} {
  let score = 0
  const missing: Array<{ weight: number; message: string }> = []

  // Skills (30 pts)
  if (talent.skills && talent.skills.length >= 3) {
    score += 30
  } else if (talent.skills && talent.skills.length > 0) {
    score += 15
    missing.push({ weight: 15, message: 'Add 3 or more skills (+15 pts) to match role requirements' })
  } else {
    missing.push({ weight: 30, message: 'Add skills (+30 pts) — skills are the highest-weighted match signal' })
  }

  // Role (20 pts)
  if (talent.role && talent.role.trim()) {
    score += 20
  } else {
    missing.push({ weight: 20, message: 'Set your primary role (+20 pts) for job matching' })
  }

  // Experience (15 pts)
  if (talent.experience_years && talent.experience_years > 0) {
    score += 15
  } else {
    missing.push({ weight: 15, message: 'Add your years of experience (+15 pts)' })
  }

  // Location (10 pts)
  if (talent.location && talent.location.trim()) {
    score += 10
  } else {
    missing.push({ weight: 10, message: 'Add your city/location (+10 pts) for local production discovery' })
  }

  // Language (10 pts)
  if (talent.language && talent.language.trim()) {
    score += 10
  } else {
    missing.push({ weight: 10, message: 'Add spoken languages (+10 pts) for regional film matching' })
  }

  // Completeness signals (10 pts total)
  let completeness = 0
  if (talent.bio && talent.bio.trim().length > 20) completeness += 3
  else missing.push({ weight: 3, message: 'Write a bio (+3 pts) summarizing your film experience' })

  if (talent.credits && talent.credits.length > 0) completeness += 3
  else missing.push({ weight: 3, message: 'Add film credits (+3 pts) to your filmography' })

  if (talent.has_resume) completeness += 2
  else missing.push({ weight: 2, message: 'Upload a PDF resume (+2 pts) for verified applications' })

  if (talent.showreel_url && talent.showreel_url.trim()) completeness += 2
  else missing.push({ weight: 2, message: 'Add a showreel video link (+2 pts)' })

  score += Math.min(10, completeness)

  // Recency baseline (5 pts)
  score += 5

  // Find highest weight missing item
  missing.sort((a, b) => b.weight - a.weight)
  const topMissingRecommendation = missing.length > 0 ? missing[0].message : null

  return {
    score: Math.min(100, score),
    topMissingRecommendation,
  }
}

// ── Profile Component ─────────────────────────────────────────

export function Profile() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const { id: paramId } = useParams<{ id: string }>()

  const viewingOwnProfile = !paramId || paramId === user?.id || paramId === user?.profileId
  const isOwn = viewingOwnProfile
  const isProductionViewer = !isOwn && user?.role === 'production'
  const isAllowedToViewResume = isOwn || user?.role === 'production'

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit mode toggle for owner
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<CreateTalentProfilePayload>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  // Upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeMessage, setResumeMessage] = useState('')

  // Showreel click-to-load state
  const [hasLoadedShowreel, setHasLoadedShowreel] = useState(false)

  // Credits modal / form state
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState({
    project_title: '',
    role: '',
    year: new Date().getFullYear().toString(),
    production_company: '',
    description: '',
    link: '',
  })
  const [savingCredit, setSavingCredit] = useState(false)
  const [creditError, setCreditError] = useState('')

  usePageTitle(
    profile
      ? profile.type === 'production'
        ? `${profile.company_name} | Profile`
        : `${profile.full_name ?? 'Talent'} | Profile`
      : 'Profile | CineConnect'
  )

  const loadProfile = useCallback(async (uid: string) => {
    setLoading(true)
    setError('')

    // 1. If viewing own profile and authenticated, use dedicated own profile endpoints
    if (viewingOwnProfile && token) {
      if (user?.role === 'production') {
        try {
          const res = await productionApi.getMyProfile(token)
          if (res?.profile) {
            setProfile({ type: 'production', ...res.profile })
            setLoading(false)
            return
          }
        } catch {
          // Fall through
        }
      } else if (user?.role === 'talent') {
        try {
          const res = await talentApi.getMyProfile(token)
          if (res?.profile) {
            setProfile({ type: 'talent', ...res.profile })
            setEditForm({
              full_name: res.profile.full_name || '',
              role: res.profile.role || '',
              roles: res.profile.roles || [],
              bio: res.profile.bio || '',
              skills: res.profile.skills || [],
              experience_years: res.profile.experience_years || 0,
              language: res.profile.language || '',
              location: res.profile.location || '',
              portfolio_url: res.profile.portfolio_url || '',
              showreel_url: res.profile.showreel_url || '',
            })
            setLoading(false)
            return
          }
        } catch {
          // Fall through
        }
      }
    }

    // 2. Try fetching as production profile by id / user_id
    try {
      const prod = await productionApi.getProfile(uid, token ?? undefined)
      if (prod?.profile) {
        setProfile({ type: 'production', ...prod.profile })
        setLoading(false)
        return
      }
    } catch {
      // not production
    }

    // 3. Try fetching as talent profile by id / user_id
    try {
      if (token) {
        const talent = await talentApi.getProfile(uid, token)
        if (talent?.profile) {
          setProfile({ type: 'talent', ...talent.profile })
          setLoading(false)
          return
        }
      }
    } catch (err: unknown) {
      setError(formatLoadErrorMessage(err, 'Profile not found'))
      setLoading(false)
      return
    }

    setError('Profile not found')
    setLoading(false)
  }, [viewingOwnProfile, token, user?.role])

  useEffect(() => {
    const targetId = viewingOwnProfile ? (user?.id ?? '') : (paramId ?? '')
    if (!targetId) {
      setLoading(false)
      return
    }
    loadProfile(targetId)
  }, [paramId, user?.id, loadProfile, viewingOwnProfile])

  // Save full edit form for talent
  const handleSaveTalentForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || profile?.type !== 'talent') return
    setSavingProfile(true)
    try {
      const res = await talentApi.updateProfile(editForm, token)
      setProfile((prev) => (prev ? { ...prev, ...res.profile, type: 'talent' } : null))
      setIsEditing(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  // Avatar upload via Server Endpoint
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingAvatar(true)
    try {
      const res = await talentApi.uploadAvatar(file, token)
      setProfile((prev) => (prev ? { ...prev, avatar_url: res.avatar_url } : null))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  // Resume upload via Server Endpoint
  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingResume(true)
    setResumeMessage('')
    try {
      await talentApi.uploadResume(file, token)
      setProfile((prev) => (prev ? { ...prev, has_resume: true } : null))
      setResumeMessage('Resume uploaded successfully')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload resume')
    } finally {
      setUploadingResume(false)
      e.target.value = ''
    }
  }

  // Delete resume via Server Endpoint
  const handleDeleteResume = async () => {
    if (!token || !confirm('Are you sure you want to remove your resume?')) return
    setResumeLoading(true)
    try {
      await talentApi.deleteResume(token)
      setProfile((prev) => (prev ? { ...prev, has_resume: false } : null))
      setResumeMessage('Resume removed')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove resume')
    } finally {
      setResumeLoading(false)
    }
  }

  // View / Download signed resume URL
  const handleViewResume = async () => {
    if (!token || !profile?.id) return
    setResumeLoading(true)
    try {
      const res = await talentApi.getResumeSignedUrl(profile.id, token)
      window.open(res.signed_url, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Unable to open resume')
    } finally {
      setResumeLoading(false)
    }
  }

  // Availability change
  const handleAvailabilityChange = async (newVal: TalentAvailability) => {
    if (!token || profile?.type !== 'talent') return
    try {
      const res = await talentApi.updateProfile({ availability: newVal }, token)
      setProfile((prev) => (prev ? { ...prev, availability: res.profile.availability } : null))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update availability')
    }
  }

  // Credits management
  const openAddCreditModal = () => {
    setEditingCreditId(null)
    setCreditForm({
      project_title: '',
      role: '',
      year: new Date().getFullYear().toString(),
      production_company: '',
      description: '',
      link: '',
    })
    setCreditError('')
    setShowCreditModal(true)
  }

  const openEditCreditModal = (credit: TalentCredit) => {
    setEditingCreditId(credit.id)
    setCreditForm({
      project_title: credit.project_title,
      role: credit.role,
      year: credit.year ? credit.year.toString() : '',
      production_company: credit.production_company || '',
      description: credit.description || '',
      link: credit.link || '',
    })
    setCreditError('')
    setShowCreditModal(true)
  }

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSavingCredit(true)
    setCreditError('')

    const payload = {
      project_title: creditForm.project_title.trim(),
      role: creditForm.role.trim(),
      year: creditForm.year ? parseInt(creditForm.year, 10) : null,
      production_company: creditForm.production_company.trim() || null,
      description: creditForm.description.trim() || null,
      link: creditForm.link.trim() || null,
    }

    try {
      if (editingCreditId) {
        const res = await talentApi.updateCredit(editingCreditId, payload, token)
        setProfile((prev) => {
          if (!prev || prev.type !== 'talent') return prev
          const updatedCredits = (prev.credits || []).map((c) =>
            c.id === editingCreditId ? res.credit : c
          )
          return { ...prev, credits: updatedCredits }
        })
      } else {
        const res = await talentApi.createCredit(payload, token)
        setProfile((prev) => {
          if (!prev || prev.type !== 'talent') return prev
          const updatedCredits = [res.credit, ...(prev.credits || [])]
          return { ...prev, credits: updatedCredits }
        })
      }
      setShowCreditModal(false)
    } catch (err: unknown) {
      setCreditError(err instanceof Error ? err.message : 'Failed to save credit')
    } finally {
      setSavingCredit(false)
    }
  }

  const handleDeleteCredit = async (creditId: string) => {
    if (!token || !confirm('Are you sure you want to delete this credit?')) return
    try {
      await talentApi.deleteCredit(creditId, token)
      setProfile((prev) => {
        if (!prev || prev.type !== 'talent') return prev
        return {
          ...prev,
          credits: (prev.credits || []).filter((c) => c.id !== creditId),
        }
      })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete credit')
    }
  }

  // Skills grouped by department
  const skillsByDepartment = useMemo<Record<string, string[]>>(() => {
    const grouped: Record<string, string[]> = {
      camera: [],
      sound: [],
      editing: [],
      'art and costume': [],
      cast: [],
      production: [],
    }
    if (profile?.type !== 'talent' || !profile.skills) return grouped

    profile.skills.forEach((skill) => {
      const dept = resolveDepartment(skill)
      if (!grouped[dept]) grouped[dept] = []
      grouped[dept].push(skill)
    })

    return grouped
  }, [profile])

  // Profile strength for talent owner
  const strengthData = useMemo(() => {
    if (profile?.type === 'talent') {
      return calculateProfileStrength(profile)
    }
    return { score: 100, topMissingRecommendation: null }
  }, [profile])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-sm bg-paper shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-paper rounded w-1/3" />
              <div className="h-4 bg-paper rounded w-1/4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 py-16">
        <div className="border border-line rounded-sm p-8 max-w-md w-full text-center space-y-4 bg-surface shadow-subtle">
          <div className="w-12 h-12 rounded-full bg-status-error/10 text-status-error flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-20 font-bold text-ink">Profile not found</h2>
          <p className="text-14 text-muted">
            The profile you are looking for does not exist or has been removed.
          </p>
          <div className="pt-2">
            <Link to="/home" className="btn-primary text-13">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── PRODUCTION PROFILE VIEW (Company account owner) ───────────
  if (profile.type === 'production') {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-6 shadow-subtle">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-sm bg-ink text-surface flex items-center justify-center text-24 font-bold select-none border border-line shrink-0">
                {profile.company_name ? profile.company_name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-24 font-bold text-ink tracking-tight">
                    {profile.company_name}
                  </h1>
                  {profile.verified === true && <VerifiedBadge size={14} />}
                </div>
                <span className="text-12 font-medium text-muted">Production House Account</span>
              </div>
            </div>

            {profile.id && (
              <Link
                to={`/company/${profile.id}`}
                className="btn-secondary text-13 inline-flex items-center gap-1.5"
              >
                <span>View public studio page</span>
                <ExternalLink size={13} />
              </Link>
            )}
          </div>

          <div className="pt-6 border-t border-line space-y-5">
            <div>
              <h2 className="text-12 font-semibold text-muted mb-1">
                About the studio
              </h2>
              <p className="reading-text prose-serif text-15 text-ink leading-relaxed whitespace-pre-wrap max-w-3xl">
                {profile.bio || 'No studio bio set yet.'}
              </p>
            </div>

            {profile.production_details && (
              <div>
                <h2 className="text-12 font-semibold text-muted mb-1">
                  Production details and equipment
                </h2>
                <p className="text-13 text-muted leading-relaxed whitespace-pre-wrap max-w-3xl">
                  {profile.production_details}
                </p>
              </div>
            )}
          </div>
        </div>

        {isOwn && (
          <div className="border border-line rounded-sm bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-14 font-bold text-ink">Data rights and privacy</h4>
              <p className="text-12 text-muted">
                Inspect compliance settings, download your data, or manage legal consents.
              </p>
            </div>
            <Link to="/settings" className="btn-secondary text-13 shrink-0">
              Manage data and privacy
            </Link>
          </div>
        )}
      </div>
    )
  }

  // ── TALENT PROFILE VIEW ───────────────────────────────────────
  const talent = profile
  const primaryRole = talent.role || 'Film Crew'
  const primaryDept = resolveDepartment(primaryRole)
  const showreel = talent.showreel_url ? getShowreelEmbedUrl(talent.showreel_url) : null

  const availabilityConfig = {
    open: { label: 'Available to work', variant: 'success' as const },
    busy: { label: 'Busy on project', variant: 'warning' as const },
    unavailable: { label: 'Unavailable', variant: 'neutral' as const },
  }[talent.availability || 'open'] || { label: 'Available to work', variant: 'neutral' as const }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Owner Profile-Strength Meter (Owner only) ───────────── */}
      {isOwn && (
        <section
          aria-labelledby="profile-strength-heading"
          className="border border-line rounded-sm bg-surface p-5 space-y-3 shadow-subtle"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-tungsten" />
              <h2 id="profile-strength-heading" className="text-14 font-bold text-ink">
                Profile strength
              </h2>
            </div>
            <span className="text-14 font-bold text-ink tnum">
              {strengthData.score}%
            </span>
          </div>

          <div className="w-full h-2 bg-paper rounded-[2px] overflow-hidden border border-line/60">
            <div
              className="h-full bg-tungsten transition-all duration-300"
              style={{ width: `${strengthData.score}%` }}
            />
          </div>

          {strengthData.topMissingRecommendation && (
            <p className="text-12 text-muted leading-normal">
              <strong className="text-ink">Highest match impact:</strong>{' '}
              {strengthData.topMissingRecommendation}
            </p>
          )}
        </section>
      )}

      {/* ── Header: Avatar, Name, Roles, Meta, Actions ──────────── */}
      <header className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-6 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="flex items-start gap-5 min-w-0 flex-1">
            {/* Avatar */}
            <div className="relative shrink-0 group">
              <Avatar
                src={talent.avatar_url}
                fallback={talent.full_name || 'Talent'}
                size="lg"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm text-24 border border-line"
              />

              {/* Owner Avatar Upload Overlay */}
              {isOwn && (
                <label
                  className="absolute inset-0 rounded-sm bg-ink/70 text-surface flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 text-center"
                  title="Upload profile photo"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Upload size={16} />
                      <span className="text-10 mt-1 font-medium">Change</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarFileChange}
                  />
                </label>
              )}
            </div>

            {/* Candidate Identity */}
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-24 sm:text-28 font-bold text-ink tracking-tight leading-tight truncate">
                  {talent.full_name || 'Anonymous Talent'}
                </h1>
              </div>

              {/* Primary Role & Secondary Roles (DepartmentMarks) */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <DepartmentMark department={primaryDept} label={primaryRole} size="md" />
                {talent.roles &&
                  talent.roles
                    .filter((r) => r !== primaryRole)
                    .map((secRole) => (
                      <DepartmentMark
                        key={secRole}
                        department={resolveDepartment(secRole)}
                        label={secRole}
                        size="sm"
                      />
                    ))}
              </div>

              {/* Meta tags: separate muted elements without middle dots */}
              <div className="flex flex-wrap items-center gap-2 text-12 text-muted pt-1">
                {talent.location && (
                  <span className="inline-flex items-center gap-1 bg-paper px-2 py-0.5 rounded-[2px] border border-line/60">
                    <MapPin size={12} className="text-muted shrink-0" />
                    <span>{talent.location}</span>
                  </span>
                )}

                <span className="bg-paper px-2 py-0.5 rounded-[2px] border border-line/60 tnum">
                  {talent.experience_years
                    ? `${pluralize(talent.experience_years, 'year')} experience`
                    : 'Entry level'}
                </span>

                {talent.language && (
                  <span className="inline-flex items-center gap-1 bg-paper px-2 py-0.5 rounded-[2px] border border-line/60">
                    <Languages size={12} className="text-muted shrink-0" />
                    <span>{talent.language}</span>
                  </span>
                )}
              </div>

              {/* Availability */}
              <div className="pt-1">
                {isOwn ? (
                  <div className="inline-flex items-center gap-2 text-12">
                    <span className="text-muted font-medium">Availability:</span>
                    <select
                      value={talent.availability || 'open'}
                      onChange={(e) => handleAvailabilityChange(e.target.value as TalentAvailability)}
                      className="select text-12 py-1 px-2 h-8 w-auto bg-surface border-line"
                    >
                      <option value="open">Available to work</option>
                      <option value="busy">Busy on project</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </div>
                ) : (
                  <Badge variant={availabilityConfig.variant} size="sm">
                    {availabilityConfig.label}
                  </Badge>
                )}
              </div>

              {/* Private Contact Note: Only visible to owner */}
              {isOwn && user?.email && (
                <p className="text-11 text-muted pt-1">
                  Account email: <strong className="text-ink">{user.email}</strong> (private to you)
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 flex items-center gap-2">
            {isProductionViewer && talent.user_id && (
              <button
                type="button"
                data-testid="message-btn"
                onClick={() => navigate(`/chat?peer=${talent.user_id}`)}
                className="btn-primary text-13 inline-flex items-center gap-1.5"
              >
                <MessageCircle size={14} />
                <span>Message</span>
              </button>
            )}

            {isOwn && (
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="btn-secondary text-13 inline-flex items-center gap-1.5"
              >
                <Pencil size={13} />
                <span>{isEditing ? 'Done editing' : 'Edit profile'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Owner Inline Edit Form ──────────────────────────────── */}
      {isOwn && isEditing && (
        <section
          aria-labelledby="edit-profile-heading"
          className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-5 shadow-subtle"
        >
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h2 id="edit-profile-heading" className="text-16 font-bold text-ink">
              Edit profile details
            </h2>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-12 font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveTalentForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="input text-13"
                  placeholder="e.g. Mira Rajput"
                />
              </div>

              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Primary role
                </label>
                <input
                  type="text"
                  value={editForm.role || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  className="input text-13"
                  placeholder="e.g. Director of Photography"
                />
              </div>
            </div>

            <div>
              <label className="block text-12 font-semibold text-muted mb-1">
                Secondary roles (comma-separated)
              </label>
              <input
                type="text"
                value={editForm.roles?.join(', ') || ''}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    roles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  }))
                }
                className="input text-13"
                placeholder="e.g. Steadicam Operator, Camera Operator"
              />
            </div>

            <div>
              <label className="block text-12 font-semibold text-muted mb-1">
                About bio (Source Serif formatting)
              </label>
              <textarea
                rows={4}
                value={editForm.bio || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                className="input text-13 resize-none reading-text"
                placeholder="Summarize your narrative, commercial, or documentary experience..."
              />
            </div>

            <div>
              <label className="block text-12 font-semibold text-muted mb-1">
                Skills (comma-separated)
              </label>
              <input
                type="text"
                value={editForm.skills?.join(', ') || ''}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  }))
                }
                className="input text-13"
                placeholder="e.g. ARRI Alexa, Steadicam, Lighting Design, DaVinci Resolve"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Years of experience
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={editForm.experience_years ?? 0}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      experience_years: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="input text-13"
                />
              </div>

              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  City / Location
                </label>
                <input
                  type="text"
                  value={editForm.location || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                  className="input text-13"
                  placeholder="e.g. Mumbai, Maharashtra"
                />
              </div>

              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Languages
                </label>
                <input
                  type="text"
                  value={editForm.language || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, language: e.target.value }))}
                  className="input text-13"
                  placeholder="e.g. English, Hindi, Telugu"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Showreel URL (YouTube or Vimeo)
                </label>
                <input
                  type="url"
                  value={editForm.showreel_url || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, showreel_url: e.target.value }))}
                  className="input text-13"
                  placeholder="https://vimeo.com/... or https://youtube.com/watch?v=..."
                />
              </div>

              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Portfolio website URL
                </label>
                <input
                  type="url"
                  value={editForm.portfolio_url || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, portfolio_url: e.target.value }))}
                  className="input text-13"
                  placeholder="https://yourportfolio.com"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary text-13"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary text-13"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Section: About (Source Serif typography) ─────────────── */}
      <section
        aria-labelledby="about-heading"
        className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-3 shadow-subtle"
      >
        <h2 id="about-heading" className="text-16 font-bold text-ink">
          About
        </h2>
        {talent.bio ? (
          <p className="reading-text prose-serif text-15 text-ink leading-relaxed whitespace-pre-line max-w-3xl">
            {talent.bio}
          </p>
        ) : (
          <p className="text-13 text-muted italic">No bio provided yet.</p>
        )}

        {talent.portfolio_url && (
          <div className="pt-2">
            <a
              href={talent.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-13 font-semibold text-ink hover:underline inline-flex items-center gap-1.5"
            >
              <span>View portfolio website</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </section>

      {/* ── Section: Skills Grouped by Department ───────────────── */}
      <section
        aria-labelledby="skills-heading"
        className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-4 shadow-subtle"
      >
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h2 id="skills-heading" className="text-16 font-bold text-ink">
            Skills by department
          </h2>
          <span className="text-12 font-medium text-muted tnum">
            {talent.skills?.length || 0} skills
          </span>
        </div>

        {talent.skills && talent.skills.length > 0 ? (
          <div className="space-y-4">
            {(
              [
                { key: 'camera', label: 'Camera' },
                { key: 'sound', label: 'Sound' },
                { key: 'editing', label: 'Editing' },
                { key: 'art and costume', label: 'Art and costume' },
                { key: 'cast', label: 'Cast' },
                { key: 'production', label: 'Production' },
              ] as const
            ).map(({ key, label }) => {
              const skillsInDept = skillsByDepartment[key] || []
              if (skillsInDept.length === 0) return null

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DepartmentMark department={key} label={label} size="sm" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {skillsInDept.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded-[2px] bg-paper text-ink border border-line text-12 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-13 text-muted italic">No skills listed yet.</p>
        )}
      </section>

      {/* ── Section: Filmography and Credits Table ──────────────── */}
      <section
        aria-labelledby="credits-heading"
        className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-4 shadow-subtle"
      >
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div>
            <h2 id="credits-heading" className="text-16 font-bold text-ink">
              Filmography and credits
            </h2>
            <p className="text-12 text-muted mt-0.5">
              Verified productions, feature films, and commercial work
            </p>
          </div>

          {isOwn && (
            <button
              type="button"
              onClick={openAddCreditModal}
              disabled={(talent.credits?.length || 0) >= 50}
              className="btn-secondary text-12 inline-flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>Add credit</span>
            </button>
          )}
        </div>

        {talent.credits && talent.credits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-13">
              <thead className="bg-paper border-b border-line text-12 font-semibold text-muted select-none">
                <tr>
                  <th className="py-2.5 px-3 w-20">Year</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Production company</th>
                  <th className="py-2.5 px-3">Link</th>
                  {isOwn && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {talent.credits.map((credit) => (
                  <tr key={credit.id} className="hover:bg-paper/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-ink tnum">
                      {credit.year || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-ink">
                      {credit.project_title}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-[2px] bg-paper text-muted border border-line text-11 font-medium">
                        {credit.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted">
                      {credit.production_company || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {credit.link ? (
                        <a
                          href={credit.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-12 font-medium text-ink hover:underline inline-flex items-center gap-1"
                        >
                          <span>View project</span>
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    {isOwn && (
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditCreditModal(credit)}
                            className="p-1 text-muted hover:text-ink transition-colors"
                            title="Edit credit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCredit(credit.id)}
                            className="p-1 text-muted hover:text-status-error transition-colors"
                            title="Delete credit"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-13 text-muted italic">No credits listed yet.</p>
        )}
      </section>

      {/* ── Section: Showreel Embed (Click-to-Load) ─────────────── */}
      <section
        aria-labelledby="showreel-heading"
        className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-3 shadow-subtle"
      >
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div>
            <h2 id="showreel-heading" className="text-16 font-bold text-ink">
              Showreel
            </h2>
            <p className="text-12 text-muted mt-0.5">
              Click-to-load video player (YouTube and Vimeo only)
            </p>
          </div>
        </div>

        {showreel ? (
          <div>
            {!hasLoadedShowreel ? (
              <div
                data-testid="showreel-click-to-load"
                onClick={() => setHasLoadedShowreel(true)}
                className="aspect-video w-full rounded-sm border border-line bg-ink text-surface flex flex-col items-center justify-center p-6 text-center cursor-pointer group hover:border-tungsten transition-colors select-none"
              >
                <div className="w-14 h-14 rounded-full bg-tungsten text-ink flex items-center justify-center group-hover:scale-105 transition-transform shadow-md mb-3">
                  <Play size={24} className="ml-1 fill-ink" />
                </div>
                <h3 className="text-16 font-bold text-surface">
                  Watch showreel on {showreel.host}
                </h3>
                <p className="text-12 text-paper/70 mt-1 max-w-sm">
                  Click to load player. Protects privacy by avoiding third-party requests until clicked.
                </p>
              </div>
            ) : (
              <div className="aspect-video w-full rounded-sm overflow-hidden border border-line bg-ink">
                <iframe
                  data-testid="showreel-iframe"
                  src={showreel.embedUrl}
                  title="Showreel player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
            )}
          </div>
        ) : talent.showreel_url ? (
          <p className="text-12 text-status-warning">
            Showreel link provided must be a valid YouTube or Vimeo URL.
          </p>
        ) : (
          <p className="text-13 text-muted italic">No showreel added yet.</p>
        )}
      </section>

      {/* ── Section: Resume (Allowed Viewers only) ───────────────── */}
      {isAllowedToViewResume && (
        <section
          aria-labelledby="resume-heading"
          className="border border-line rounded-sm bg-surface p-6 sm:p-8 space-y-3 shadow-subtle"
        >
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <div>
              <h2 id="resume-heading" className="text-16 font-bold text-ink">
                Resume and curriculum vitae
              </h2>
              <p className="text-12 text-muted mt-0.5">
                Verified document accessible only to authorized productions
              </p>
            </div>
            {isOwn && talent.has_resume && (
              <button
                type="button"
                onClick={handleDeleteResume}
                disabled={resumeLoading}
                className="text-12 text-status-error hover:underline inline-flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>Remove</span>
              </button>
            )}
          </div>

          {talent.has_resume ? (
            <div className="p-4 bg-paper rounded-sm border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText size={22} className="text-ink shrink-0" />
                <div>
                  <p className="text-14 font-semibold text-ink">Resume document (PDF)</p>
                  <p className="text-11 text-muted">Secured via signed URL access</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleViewResume}
                disabled={resumeLoading}
                className="btn-secondary text-13 inline-flex items-center gap-1.5 shrink-0"
              >
                {resumeLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>View resume</span>
              </button>
            </div>
          ) : (
            <div>
              {isOwn ? (
                <div className="p-6 border border-dashed border-line rounded-sm text-center space-y-2 bg-paper/30">
                  <FileText size={28} className="mx-auto text-muted opacity-60" />
                  <p className="text-13 text-muted">
                    Upload your resume in PDF format (up to 5 MB)
                  </p>
                  <label className="btn-secondary text-13 inline-flex items-center gap-1.5 cursor-pointer">
                    {uploadingResume ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    <span>Upload PDF resume</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={uploadingResume}
                      onChange={handleResumeFileChange}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-13 text-muted italic">No resume attached to this profile.</p>
              )}
            </div>
          )}

          {resumeMessage && (
            <p className="text-12 text-status-success font-medium">{resumeMessage}</p>
          )}
        </section>
      )}

      {/* ── Section: Data Rights & Privacy (Owner only) ─────────── */}
      {isOwn && (
        <div className="border border-line rounded-sm bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div>
            <h3 className="text-14 font-bold text-ink">Data rights and privacy</h3>
            <p className="text-12 text-muted">
              Download your data, inspect legal consents, or request account erasure.
            </p>
          </div>
          <Link to="/settings" className="btn-secondary text-13 shrink-0">
            Manage data and privacy
          </Link>
        </div>
      )}

      {/* ── Modal: Credit Modal ─────────────────────────────────── */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="border border-line rounded-sm bg-surface max-w-md w-full p-6 space-y-4 shadow-floating">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="text-16 font-bold text-ink">
                {editingCreditId ? 'Edit credit' : 'Add credit'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {creditError && (
              <p className="text-12 text-status-error font-medium">{creditError}</p>
            )}

            <form onSubmit={handleSaveCredit} className="space-y-3">
              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Project title *
                </label>
                <input
                  type="text"
                  required
                  value={creditForm.project_title}
                  onChange={(e) =>
                    setCreditForm((p) => ({ ...p, project_title: e.target.value }))
                  }
                  className="input text-13"
                  placeholder="e.g. Shadows in the Mist"
                />
              </div>

              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Role *
                </label>
                <input
                  type="text"
                  required
                  value={creditForm.role}
                  onChange={(e) => setCreditForm((p) => ({ ...p, role: e.target.value }))}
                  className="input text-13"
                  placeholder="e.g. Director of Photography"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-12 font-semibold text-muted mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={creditForm.year}
                    onChange={(e) => setCreditForm((p) => ({ ...p, year: e.target.value }))}
                    className="input text-13"
                    placeholder="2026"
                  />
                </div>

                <div>
                  <label className="block text-12 font-semibold text-muted mb-1">
                    Production company
                  </label>
                  <input
                    type="text"
                    value={creditForm.production_company}
                    onChange={(e) =>
                      setCreditForm((p) => ({ ...p, production_company: e.target.value }))
                    }
                    className="input text-13"
                    placeholder="e.g. Excel Entertainment"
                  />
                </div>
              </div>

              <div>
                <label className="block text-12 font-semibold text-muted mb-1">
                  Project link (IMDb, Vimeo, or YouTube)
                </label>
                <input
                  type="url"
                  value={creditForm.link}
                  onChange={(e) => setCreditForm((p) => ({ ...p, link: e.target.value }))}
                  className="input text-13"
                  placeholder="https://imdb.com/title/..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="btn-secondary text-13"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCredit}
                  className="btn-primary text-13"
                >
                  {savingCredit ? 'Saving...' : 'Save credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
