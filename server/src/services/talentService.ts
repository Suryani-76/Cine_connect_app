import { supabase } from '../db/supabase'
import { DbTalentProfile, DbTalentCredit, TalentAvailability } from '../types'
import { enqueueMatchRecompute } from './recomputeService'
import { CallerContext } from '../middleware/callerContext'
import {
  validateAvatarUpload,
  validateResumeUpload,
  isValidShowreelUrl,
  uploadAvatarToStorage,
  uploadResumeToStorage,
  deleteResumeFromStorage,
  createSignedResumeUrl,
} from './storageService'

const TALENT_PROFILE_COLUMNS =
  'id, user_id, full_name, bio, role, roles, showreel_url, availability, skills, experience_years, language, location, avatar_url, portfolio_url, resume_path, last_active_at, created_at'

export interface CreateTalentProfileInput {
  user_id: string
  full_name?: string
  bio?: string
  role?: string
  roles?: string[]
  skills?: string[]
  experience_years?: number
  language?: string
  location?: string
  avatar_url?: string | null
  portfolio_url?: string | null
  showreel_url?: string | null
  availability?: TalentAvailability
  resume_path?: string | null
}

export interface TalentProfileWithCredits extends Omit<DbTalentProfile, 'resume_path'> {
  has_resume: boolean
  credits: DbTalentCredit[]
  users?: { username: string; role: string }
}

// ── Create / upsert talent profile ───────────────────────────

export async function createTalentProfile(
  input: CreateTalentProfileInput
): Promise<DbTalentProfile> {
  // Guard: user must exist with talent role
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', input.user_id)
    .single()

  if (userError || !user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 })
  }

  if (user.role !== 'talent') {
    throw Object.assign(
      new Error('Only talent accounts can create a talent profile'),
      { statusCode: 403 }
    )
  }

  if (input.showreel_url && !isValidShowreelUrl(input.showreel_url)) {
    throw Object.assign(
      new Error('Invalid showreel URL. Only YouTube and Vimeo links are supported.'),
      { statusCode: 400 }
    )
  }

  if (input.availability && !['open', 'busy', 'unavailable'].includes(input.availability)) {
    throw Object.assign(new Error("Availability must be 'open', 'busy', or 'unavailable'"), {
      statusCode: 400,
    })
  }

  // Ensure role is in roles array as primary
  const primaryRole = input.role?.trim() || null
  let roles = Array.isArray(input.roles) ? [...input.roles] : []
  if (primaryRole && !roles.includes(primaryRole)) {
    roles = [primaryRole, ...roles]
  }

  const { data, error } = await supabase
    .from('talent_profiles')
    .insert({
      user_id:          input.user_id,
      full_name:        input.full_name        ?? null,
      bio:              input.bio              ?? null,
      role:             primaryRole,
      roles:            roles,
      skills:           input.skills           ?? [],
      experience_years: input.experience_years ?? 0,
      language:         input.language         ?? null,
      location:         input.location         ?? null,
      avatar_url:       input.avatar_url       ?? null,
      portfolio_url:    input.portfolio_url    ?? null,
      showreel_url:     input.showreel_url     ?? null,
      availability:     input.availability     ?? 'open',
      resume_path:      input.resume_path      ?? null,
    })
    .select(TALENT_PROFILE_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw Object.assign(new Error('Talent profile already exists for this user'), {
        statusCode: 409,
      })
    }
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  try {
    await enqueueMatchRecompute({
      talentProfileId: (data as DbTalentProfile).id,
      reason: 'Talent profile created',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbTalentProfile
}

// ── Update talent profile ─────────────────────────────────────

export async function updateTalentProfile(
  talentProfileId: string,
  input: Partial<CreateTalentProfileInput>
): Promise<DbTalentProfile> {
  if (input.showreel_url !== undefined && input.showreel_url !== null && input.showreel_url !== '') {
    if (!isValidShowreelUrl(input.showreel_url)) {
      throw Object.assign(
        new Error('Invalid showreel URL. Only YouTube and Vimeo links are supported.'),
        { statusCode: 400 }
      )
    }
  }

  if (input.availability && !['open', 'busy', 'unavailable'].includes(input.availability)) {
    throw Object.assign(new Error("Availability must be 'open', 'busy', or 'unavailable'"), {
      statusCode: 400,
    })
  }

  const updatePayload: Record<string, unknown> = {}
  if (input.full_name !== undefined)        updatePayload.full_name = input.full_name
  if (input.bio !== undefined)              updatePayload.bio = input.bio
  if (input.role !== undefined)             updatePayload.role = input.role
  if (input.skills !== undefined)           updatePayload.skills = input.skills
  if (input.experience_years !== undefined) updatePayload.experience_years = input.experience_years
  if (input.language !== undefined)         updatePayload.language = input.language
  if (input.location !== undefined)         updatePayload.location = input.location
  if (input.avatar_url !== undefined)       updatePayload.avatar_url = input.avatar_url
  if (input.portfolio_url !== undefined)    updatePayload.portfolio_url = input.portfolio_url
  if (input.showreel_url !== undefined)     updatePayload.showreel_url = input.showreel_url
  if (input.availability !== undefined)     updatePayload.availability = input.availability

  if (input.roles !== undefined) {
    let roles = [...input.roles]
    const primary = (input.role !== undefined ? input.role : null)?.trim()
    if (primary && !roles.includes(primary)) {
      roles = [primary, ...roles]
    }
    updatePayload.roles = roles
  } else if (input.role !== undefined && input.role) {
    // If role changed but roles wasn't provided, ensure primary is in roles
    const { data: current } = await supabase
      .from('talent_profiles')
      .select('roles')
      .eq('id', talentProfileId)
      .single()
    const currentRoles: string[] = current?.roles ?? []
    if (!currentRoles.includes(input.role)) {
      updatePayload.roles = [input.role, ...currentRoles]
    }
  }

  const { data, error } = await supabase
    .from('talent_profiles')
    .update(updatePayload)
    .eq('id', talentProfileId)
    .select(TALENT_PROFILE_COLUMNS)
    .single()

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 })
  }

  try {
    await enqueueMatchRecompute({
      talentProfileId,
      reason: 'Talent profile updated',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbTalentProfile
}

// ── Search talent ─────────────────────────────────────────────

export interface SearchTalentFilter {
  skills?: string[]
  role?: string
  location?: string
  language?: string
  availability?: string
  limit?: number
  offset?: number
}

/**
 * Returns talent profiles matching the given filters.
 * Never returns email or private resume path. Paginated (default 20, max 50).
 */
export async function searchTalent(
  filter: SearchTalentFilter
): Promise<Array<Omit<DbTalentProfile, 'user_id' | 'resume_path'>>> {
  const limit  = Math.min(filter.limit  ?? 20, 50)
  const offset = filter.offset ?? 0

  let query = supabase
    .from('talent_profiles')
    .select(
      'id, full_name, bio, role, roles, showreel_url, availability, skills, experience_years, language, location, avatar_url, portfolio_url, last_active_at, created_at'
    )
    .order('last_active_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter.skills && filter.skills.length > 0) {
    query = query.overlaps('skills', filter.skills)
  }
  if (filter.role) {
    // Search both primary role and roles array
    query = query.or(`role.ilike.%${filter.role}%,roles.cs.{${filter.role}}`)
  }
  if (filter.location)     query = query.ilike('location', `%${filter.location}%`)
  if (filter.language)     query = query.ilike('language', `%${filter.language}%`)
  if (filter.availability && filter.availability !== 'all') {
    query = query.eq('availability', filter.availability)
  }

  const { data, error } = await query
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
  return (data ?? []) as Array<Omit<DbTalentProfile, 'user_id' | 'resume_path'>>
}

// ── Get talent profile (with credits & availability) ──────────

export async function getTalentProfileByUserId(
  userId: string
): Promise<TalentProfileWithCredits> {
  const { data, error } = await supabase
    .from('talent_profiles')
    .select(`${TALENT_PROFILE_COLUMNS}, users(username, role)`)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    throw Object.assign(new Error('Talent profile not found'), { statusCode: 404 })
  }

  const credits = await getCreditsByTalentProfileId(data.id)
  const { resume_path, ...cleanProfile } = data

  return {
    ...cleanProfile,
    has_resume: Boolean(resume_path),
    credits,
  } as unknown as TalentProfileWithCredits
}

export async function getTalentProfileById(
  idOrUserId: string
): Promise<TalentProfileWithCredits> {
  let { data, error } = await supabase
    .from('talent_profiles')
    .select(`${TALENT_PROFILE_COLUMNS}, users(username, role)`)
    .eq('id', idOrUserId)
    .maybeSingle()

  if (!data && !error) {
    const res = await supabase
      .from('talent_profiles')
      .select(`${TALENT_PROFILE_COLUMNS}, users(username, role)`)
      .eq('user_id', idOrUserId)
      .maybeSingle()
    data = res.data
    error = res.error
  }

  if (error || !data) {
    throw Object.assign(new Error('Talent profile not found'), { statusCode: 404 })
  }

  const credits = await getCreditsByTalentProfileId(data.id)
  const { resume_path, ...cleanProfile } = data

  return {
    ...cleanProfile,
    has_resume: Boolean(resume_path),
    credits,
  } as unknown as TalentProfileWithCredits
}

// ── Availability ──────────────────────────────────────────────

export async function updateTalentAvailability(
  talentProfileId: string,
  availability: 'open' | 'busy' | 'unavailable'
): Promise<{ availability: string }> {
  if (!['open', 'busy', 'unavailable'].includes(availability)) {
    throw Object.assign(new Error("Availability must be 'open', 'busy', or 'unavailable'"), {
      statusCode: 400,
    })
  }

  const { data, error } = await supabase
    .from('talent_profiles')
    .update({ availability })
    .eq('id', talentProfileId)
    .select('id, availability')
    .single()

  if (error || !data) {
    throw Object.assign(new Error(error ? error.message : 'Talent profile not found'), {
      statusCode: 404,
    })
  }

  return { availability: data.availability }
}

// ── Credits CRUD (max 50 credits, owner only) ─────────────────

export interface CreateCreditInput {
  talent_profile_id: string
  project_title: string
  role: string
  year?: number | null
  production_company?: string | null
  description?: string | null
  link?: string | null
}

export async function getCreditsByTalentProfileId(
  talentProfileId: string
): Promise<DbTalentCredit[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('talent_credits')
      .select('*')
      .eq('talent_profile_id', talentProfileId)

    if (query && typeof query.order === 'function') {
      query = query.order('year', { ascending: false, nullsFirst: false })
      if (query && typeof query.order === 'function') {
        query = query.order('created_at', { ascending: false })
      }
    }

    const { data, error } = await query
    if (error) return []
    return (data ?? []) as DbTalentCredit[]
  } catch {
    return []
  }
}

export async function createCredit(
  input: CreateCreditInput
): Promise<DbTalentCredit> {
  const { count, error: countErr } = await supabase
    .from('talent_credits')
    .select('id', { count: 'exact', head: true })
    .eq('talent_profile_id', input.talent_profile_id)

  if (countErr) throw Object.assign(new Error(countErr.message), { statusCode: 500 })
  if ((count ?? 0) >= 50) {
    throw Object.assign(new Error('Maximum limit of 50 credits reached'), { statusCode: 400 })
  }

  const { data, error } = await supabase
    .from('talent_credits')
    .insert({
      talent_profile_id:  input.talent_profile_id,
      project_title:      input.project_title,
      role:               input.role,
      year:               input.year               ?? null,
      production_company: input.production_company ?? null,
      description:        input.description        ?? null,
      link:               input.link               ?? null,
    })
    .select('*')
    .single()

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })

  try {
    await enqueueMatchRecompute({
      talentProfileId: input.talent_profile_id,
      reason: 'Talent credit added',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbTalentCredit
}

export async function updateCredit(
  creditId: string,
  talentProfileId: string,
  update: Partial<CreateCreditInput>
): Promise<DbTalentCredit> {
  const updatePayload: Record<string, unknown> = {}
  if (update.project_title !== undefined)      updatePayload.project_title = update.project_title
  if (update.role !== undefined)               updatePayload.role = update.role
  if (update.year !== undefined)               updatePayload.year = update.year
  if (update.production_company !== undefined) updatePayload.production_company = update.production_company
  if (update.description !== undefined)        updatePayload.description = update.description
  if (update.link !== undefined)               updatePayload.link = update.link

  const { data, error } = await supabase
    .from('talent_credits')
    .update(updatePayload)
    .eq('id', creditId)
    .eq('talent_profile_id', talentProfileId)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    throw Object.assign(new Error('Credit not found or unauthorized'), { statusCode: 404 })
  }

  try {
    await enqueueMatchRecompute({
      talentProfileId,
      reason: 'Talent credit updated',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return data as DbTalentCredit
}

export async function deleteCredit(
  creditId: string,
  talentProfileId: string
): Promise<void> {
  const { error, count } = await supabase
    .from('talent_credits')
    .delete({ count: 'exact' })
    .eq('id', creditId)
    .eq('talent_profile_id', talentProfileId)

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
  if (count === 0) {
    throw Object.assign(new Error('Credit not found or unauthorized'), { statusCode: 404 })
  }

  try {
    await enqueueMatchRecompute({
      talentProfileId,
      reason: 'Talent credit deleted',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }
}

// ── Uploads & Signed URLs ─────────────────────────────────────

export async function uploadTalentAvatar(
  userId: string,
  talentProfileId: string,
  file: Express.Multer.File
): Promise<{ avatar_url: string }> {
  const validation = validateAvatarUpload({
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
    originalname: file.originalname,
  })

  if (!validation.valid) {
    throw Object.assign(new Error(validation.error || 'Invalid avatar upload'), { statusCode: 400 })
  }

  const { publicUrl } = await uploadAvatarToStorage(userId, file.buffer, file.mimetype)

  const { error } = await supabase
    .from('talent_profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', talentProfileId)

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })

  try {
    await enqueueMatchRecompute({
      talentProfileId,
      reason: 'Avatar updated',
    })
  } catch (recomputeErr) {
    console.warn('[TalentService] Failed to enqueue match recompute:', recomputeErr)
  }

  return { avatar_url: publicUrl }
}

export async function uploadTalentResume(
  userId: string,
  talentProfileId: string,
  file: Express.Multer.File
): Promise<{ resume_path: string; message: string }> {
  const validation = validateResumeUpload({
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
    originalname: file.originalname,
  })

  if (!validation.valid) {
    throw Object.assign(new Error(validation.error || 'Invalid resume upload'), { statusCode: 400 })
  }

  const { path } = await uploadResumeToStorage(userId, file.buffer)

  const { error } = await supabase
    .from('talent_profiles')
    .update({ resume_path: path })
    .eq('id', talentProfileId)

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })

  return { resume_path: path, message: 'Resume uploaded successfully' }
}

export async function deleteTalentResume(
  talentProfileId: string
): Promise<{ message: string }> {
  const { data: profile, error } = await supabase
    .from('talent_profiles')
    .select('id, resume_path')
    .eq('id', talentProfileId)
    .single()

  if (error || !profile) {
    throw Object.assign(new Error('Talent profile not found'), { statusCode: 404 })
  }

  if (profile.resume_path) {
    await deleteResumeFromStorage(profile.resume_path)
  }

  await supabase
    .from('talent_profiles')
    .update({ resume_path: null })
    .eq('id', talentProfileId)

  return { message: 'Resume deleted successfully' }
}

export async function getTalentResumeSignedUrl(
  talentProfileId: string,
  caller: CallerContext
): Promise<{ signed_url: string; expires_in: number }> {
  const { data: profile, error } = await supabase
    .from('talent_profiles')
    .select('id, user_id, resume_path')
    .eq('id', talentProfileId)
    .maybeSingle()

  if (error || !profile) {
    throw Object.assign(new Error('Talent profile not found'), { statusCode: 404 })
  }

  if (!profile.resume_path) {
    throw Object.assign(new Error('Talent profile has no resume uploaded'), { statusCode: 404 })
  }

  // Check authorization:
  // 1. Owner
  const isOwner = caller.userId === profile.user_id || caller.talentProfileId === talentProfileId
  if (isOwner) {
    const signedUrl = await createSignedResumeUrl(profile.resume_path, 60)
    return { signed_url: signedUrl, expires_in: 60 }
  }

  // 2. Production user who received an application from that talent
  if (caller.role === 'production' && caller.productionProfileId) {
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, jobs!inner(production_id)')
      .eq('talent_profile_id', talentProfileId)
      .eq('jobs.production_id', caller.productionProfileId)
      .limit(1)
      .maybeSingle()

    if (!appError && application) {
      const signedUrl = await createSignedResumeUrl(profile.resume_path, 60)
      return { signed_url: signedUrl, expires_in: 60 }
    }
  }

  // All other users:
  throw Object.assign(
    new Error('Access to candidate resume requires an active application to your job'),
    { statusCode: 403 }
  )
}
