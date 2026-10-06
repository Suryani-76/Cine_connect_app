/**
 * vocabService.ts
 * ───────────────
 * Controlled vocabulary service for film skills, roles, and cities.
 * Provides fast autocomplete search with in-memory caching and alias resolution.
 */

import { supabase } from '../db/supabase'
import { normalizeString } from '../utils/normalize'

export interface VocabItem {
  id?: string
  name: string
  category?: string
  department?: string
  state?: string | null
  country?: string
  is_verified?: boolean
}

// ── In-Memory Default Seeds (Fallback & Cache Initializer) ───

const DEFAULT_CITIES: VocabItem[] = [
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', is_verified: true },
  { name: 'Hyderabad', state: 'Telangana', country: 'India', is_verified: true },
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', is_verified: true },
  { name: 'Bengaluru', state: 'Karnataka', country: 'India', is_verified: true },
  { name: 'Kochi', state: 'Kerala', country: 'India', is_verified: true },
  { name: 'Kolkata', state: 'West Bengal', country: 'India', is_verified: true },
  { name: 'Delhi', state: 'Delhi NCR', country: 'India', is_verified: true },
  { name: 'Pune', state: 'Maharashtra', country: 'India', is_verified: true },
  { name: 'Thiruvananthapuram', state: 'Kerala', country: 'India', is_verified: true },
  { name: 'Jaipur', state: 'Rajasthan', country: 'India', is_verified: true },
  { name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', is_verified: true },
  { name: 'Ahmedabad', state: 'Gujarat', country: 'India', is_verified: true },
  { name: 'Chandigarh', state: 'Punjab/Haryana', country: 'India', is_verified: true },
  ('Goa' as unknown as VocabItem),
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', is_verified: true },
  { name: 'Remote', state: null, country: 'Worldwide', is_verified: true },
].map(c => typeof c === 'string' ? { name: c, is_verified: true } : c)

const DEFAULT_ROLES: VocabItem[] = [
  { name: 'Director', department: 'Directing', is_verified: true },
  { name: 'Co-Director', department: 'Directing', is_verified: true },
  { name: 'Associate Director', department: 'Directing', is_verified: true },
  { name: 'First Assistant Director (1st AD)', department: 'Directing', is_verified: true },
  { name: 'Second Assistant Director (2nd AD)', department: 'Directing', is_verified: true },
  { name: 'Script Supervisor / Continuity', department: 'Directing', is_verified: true },
  { name: 'Screenwriter', department: 'Writing', is_verified: true },
  { name: 'Dialogue Writer', department: 'Writing', is_verified: true },
  { name: 'Story Writer', department: 'Writing', is_verified: true },
  { name: 'Casting Director', department: 'Casting', is_verified: true },
  { name: 'Producer', department: 'Production', is_verified: true },
  { name: 'Executive Producer', department: 'Production', is_verified: true },
  { name: 'Line Producer', department: 'Production', is_verified: true },
  { name: 'Production Manager', department: 'Production', is_verified: true },
  { name: 'Cinematographer', department: 'Camera', is_verified: true },
  { name: 'Camera Operator', department: 'Camera', is_verified: true },
  { name: 'First Assistant Camera (1st AC / Focus Puller)', department: 'Camera', is_verified: true },
  { name: 'Second Assistant Camera (2nd AC)', department: 'Camera', is_verified: true },
  { name: 'Drone Operator', department: 'Camera', is_verified: true },
  { name: 'Steadicam Operator', department: 'Camera', is_verified: true },
  { name: 'Digital Imaging Technician (DIT)', department: 'Camera', is_verified: true },
  { name: 'Gaffer', department: 'Lighting', is_verified: true },
  { name: 'Key Grip', department: 'Grip', is_verified: true },
  { name: 'Production Designer', department: 'Art Department', is_verified: true },
  { name: 'Art Director', department: 'Art Department', is_verified: true },
  { name: 'Costume Designer', department: 'Wardrobe', is_verified: true },
  { name: 'Key Makeup Artist', department: 'Hair & Makeup', is_verified: true },
  { name: 'Lead Actor', department: 'Acting', is_verified: true },
  { name: 'Supporting Actor', department: 'Acting', is_verified: true },
  { name: 'Stunt Coordinator', department: 'Stunts', is_verified: true },
  { name: 'Editor', department: 'Post-Production', is_verified: true },
  { name: 'Assistant Editor', department: 'Post-Production', is_verified: true },
  { name: 'Colorist', department: 'Post-Production', is_verified: true },
  { name: 'Post-Production Supervisor', department: 'Post-Production', is_verified: true },
  { name: 'Sound Designer', department: 'Sound', is_verified: true },
  { name: 'Production Sound Mixer', department: 'Sound', is_verified: true },
  { name: 'Music Director / Composer', department: 'Music', is_verified: true },
  { name: 'Visual Effects (VFX) Supervisor', department: 'VFX', is_verified: true },
]

const DEFAULT_SKILLS: VocabItem[] = [
  { name: 'Cinematography', category: 'Camera', is_verified: true },
  { name: 'Anamorphic Lenses', category: 'Camera', is_verified: true },
  { name: 'Steadicam Operation', category: 'Camera', is_verified: true },
  { name: 'Drone Cinematography', category: 'Camera', is_verified: true },
  { name: 'Focus Pulling', category: 'Camera', is_verified: true },
  { name: 'Lighting Design', category: 'Lighting', is_verified: true },
  { name: 'Grip & Rigging', category: 'Grip', is_verified: true },
  { name: 'Location Sound Recording', category: 'Sound', is_verified: true },
  { name: 'Boom Operation', category: 'Sound', is_verified: true },
  { name: 'Sync Sound', category: 'Sound', is_verified: true },
  { name: 'Sound Design', category: 'Sound', is_verified: true },
  { name: 'Foley Recording', category: 'Sound', is_verified: true },
  { name: 'Sound Mixing', category: 'Sound', is_verified: true },
  { name: 'Dolby Atmos Mixing', category: 'Sound', is_verified: true },
  { name: 'Pro Tools', category: 'Sound', is_verified: true },
  { name: 'DaVinci Resolve', category: 'Post-Production', is_verified: true },
  { name: 'Adobe Premiere Pro', category: 'Post-Production', is_verified: true },
  { name: 'Final Cut Pro', category: 'Post-Production', is_verified: true },
  { name: 'Avid Media Composer', category: 'Post-Production', is_verified: true },
  { name: 'Color Grading', category: 'Post-Production', is_verified: true },
  { name: 'Color Correction', category: 'Post-Production', is_verified: true },
  { name: 'Visual Effects (VFX) Supervision', category: 'VFX', is_verified: true },
  { name: 'Compositing', category: 'VFX', is_verified: true },
  { name: 'Rotoscoping', category: 'VFX', is_verified: true },
  { name: 'Adobe After Effects', category: 'VFX', is_verified: true },
  { name: 'Nuke', category: 'VFX', is_verified: true },
  { name: 'Blender', category: 'VFX', is_verified: true },
  { name: 'Maya', category: 'VFX', is_verified: true },
  { name: 'Scriptwriting', category: 'Writing', is_verified: true },
  { name: 'Screenplay Formatting', category: 'Writing', is_verified: true },
  { name: 'Line Producing', category: 'Production', is_verified: true },
  { name: 'Production Management', category: 'Production', is_verified: true },
  { name: 'Budgeting & Scheduling', category: 'Production', is_verified: true },
  { name: 'Movie Magic Scheduling', category: 'Production', is_verified: true },
  { name: 'Casting Direction', category: 'Casting', is_verified: true },
  { name: 'Location Scouting', category: 'Production', is_verified: true },
  { name: 'Production Design', category: 'Art Department', is_verified: true },
  { name: 'Costume Design', category: 'Wardrobe', is_verified: true },
  { name: 'Special Effects (SFX) Makeup', category: 'Hair & Makeup', is_verified: true },
  { name: 'Method Acting', category: 'Acting', is_verified: true },
  { name: 'Stunt Rigging', category: 'Stunts', is_verified: true },
]

const DEFAULT_ALIASES: Record<string, string> = {
  'dop': 'Cinematographer',
  'director of photography': 'Cinematographer',
  'dit': 'Digital Imaging Technician (DIT)',
  'colourist': 'Colorist',
  'colour grading': 'Color Grading',
  'colour correction': 'Color Correction',
  'ad': 'Assistant Director',
  '1st ad': 'First Assistant Director (1st AD)',
  '2nd ad': 'Second Assistant Director (2nd AD)',
  'sync sound': 'Sync Sound',
  'sound recordist': 'Production Sound Mixer',
  'boom op': 'Boom Operator',
  'focus puller': 'First Assistant Camera (1st AC / Focus Puller)',
  '1st ac': 'First Assistant Camera (1st AC / Focus Puller)',
  '2nd ac': 'Second Assistant Camera (2nd AC)',
  'audio mixing': 'Sound Mixing',
  'foley': 'Foley Recording',
  'adr': 'ADR (Automated Dialogue Replacement)',
  'davinci': 'DaVinci Resolve',
  'premiere': 'Adobe Premiere Pro',
  'premiere pro': 'Adobe Premiere Pro',
  'fcp': 'Final Cut Pro',
  'avid': 'Avid Media Composer',
  'after effects': 'Adobe After Effects',
  'ae': 'Adobe After Effects',
  'pro tools': 'Pro Tools',
  'protools': 'Pro Tools',
  'drone': 'Drone Cinematography',
  'steadicam': 'Steadicam Operation',
  'gimbal': 'Gimbal Operation',
  'vfx': 'Visual Effects (VFX) Supervision',
  'sfx': 'Sound Effects (SFX) Design',
  'cgi': 'CGI Modeling',
  'script writing': 'Scriptwriting',
  'screenplay': 'Scriptwriting',
  'roto': 'Rotoscoping',
  'green screen': 'Chroma Keying (Green/Blue Screen)',
  'chroma key': 'Chroma Keying (Green/Blue Screen)',
  'lighting': 'Lighting Design',
}

// ── Cache Layer (5-Minute TTL) ────────────────────────────────

interface CacheBox<T> {
  data: T
  expiresAt: number
}

let skillsCache: CacheBox<VocabItem[]> | null = null
let rolesCache: CacheBox<VocabItem[]> | null = null
let citiesCache: CacheBox<VocabItem[]> | null = null
let aliasesCache: CacheBox<Map<string, string>> | null = null

const CACHE_TTL_MS = 5 * 60 * 1000

async function loadSkills(): Promise<VocabItem[]> {
  const now = Date.now()
  if (skillsCache && skillsCache.expiresAt > now) return skillsCache.data

  try {
    const { data, error } = await supabase
      .from('skills')
      .select('id, name, category, is_verified')
      .order('name')

    if (!error && data && data.length > 0) {
      skillsCache = { data, expiresAt: now + CACHE_TTL_MS }
      return data
    }
  } catch {
    // Fall back to default seeds
  }

  skillsCache = { data: DEFAULT_SKILLS, expiresAt: now + CACHE_TTL_MS }
  return DEFAULT_SKILLS
}

async function loadRoles(): Promise<VocabItem[]> {
  const now = Date.now()
  if (rolesCache && rolesCache.expiresAt > now) return rolesCache.data

  try {
    const { data, error } = await supabase
      .from('roles')
      .select('id, name, department, is_verified')
      .order('name')

    if (!error && data && data.length > 0) {
      rolesCache = { data, expiresAt: now + CACHE_TTL_MS }
      return data
    }
  } catch {
    // Fall back
  }

  rolesCache = { data: DEFAULT_ROLES, expiresAt: now + CACHE_TTL_MS }
  return DEFAULT_ROLES
}

async function loadCities(): Promise<VocabItem[]> {
  const now = Date.now()
  if (citiesCache && citiesCache.expiresAt > now) return citiesCache.data

  try {
    const { data, error } = await supabase
      .from('cities')
      .select('id, name, state, country, is_verified')
      .order('name')

    if (!error && data && data.length > 0) {
      citiesCache = { data, expiresAt: now + CACHE_TTL_MS }
      return data
    }
  } catch {
    // Fall back
  }

  citiesCache = { data: DEFAULT_CITIES, expiresAt: now + CACHE_TTL_MS }
  return DEFAULT_CITIES
}

export async function loadAliasesMap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (aliasesCache && aliasesCache.expiresAt > now) return aliasesCache.data

  const map = new Map<string, string>()
  // Populate defaults
  for (const [alias, canonical] of Object.entries(DEFAULT_ALIASES)) {
    map.set(normalizeString(alias), canonical)
  }

  try {
    const { data, error } = await supabase
      .from('skill_aliases')
      .select('alias, canonical_name')

    if (!error && data && data.length > 0) {
      for (const row of data) {
        map.set(normalizeString(row.alias), row.canonical_name)
      }
    }
  } catch {
    // Keep defaults
  }

  aliasesCache = { data: map, expiresAt: now + CACHE_TTL_MS }
  return map
}

/**
 * Resolves a skill or role against the alias map and canonical terms.
 * If alias exists, returns canonical name; otherwise returns input trimmed.
 */
export function canonicalizeSkill(skill: string, aliasMap?: Map<string, string>): string {
  if (!skill) return ''
  const norm = normalizeString(skill)
  if (aliasMap && aliasMap.has(norm)) {
    return aliasMap.get(norm)!
  }
  if (DEFAULT_ALIASES[norm]) {
    return DEFAULT_ALIASES[norm]
  }
  return skill.trim()
}

// ── Autocomplete Search Utilities ─────────────────────────────

function searchItems(items: VocabItem[], query: string, limit = 20): VocabItem[] {
  const normQ = normalizeString(query)
  if (!normQ) return items.slice(0, limit)

  return items
    .filter(item => normalizeString(item.name).includes(normQ))
    .slice(0, limit)
}

export async function searchSkills(query: string, limit = 20): Promise<VocabItem[]> {
  const all = await loadSkills()
  return searchItems(all, query, limit)
}

export async function searchRoles(query: string, limit = 20): Promise<VocabItem[]> {
  const all = await loadRoles()
  return searchItems(all, query, limit)
}

export async function searchCities(query: string, limit = 20): Promise<VocabItem[]> {
  const all = await loadCities()
  return searchItems(all, query, limit)
}

/** Invalidate cache (e.g. after seed or vocabulary update) */
export function invalidateVocabCache(): void {
  skillsCache = null
  rolesCache = null
  citiesCache = null
  aliasesCache = null
}
