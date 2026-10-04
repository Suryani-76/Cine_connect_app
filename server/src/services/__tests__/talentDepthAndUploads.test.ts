import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { talentRouter } from '../../routes/talent'
import { errorHandler } from '../../middleware/errorHandler'
import {
  validateAvatarUpload,
  validateResumeUpload,
  sniffMagicBytes,
  isValidShowreelUrl,
  getShowreelEmbedUrl,
} from '../storageService'
import { calculateMatchScore } from '../matchScore'
import { JobForScoring, TalentForScoring } from '../../types'

// ── Test Personas ─────────────────────────────────────────────
const TALENT_USER_ID = '11111111-1111-4111-a111-111111111111'
const TALENT_PROFILE_ID = '22222222-2222-4222-a222-222222222222'

const OTHER_TALENT_USER_ID = '33333333-3333-4333-a333-333333333333'
const OTHER_TALENT_PROFILE_ID = '44444444-4444-4444-a444-444444444444'

const PROD_WITH_APP_USER_ID = '55555555-5555-4555-a555-555555555555'
const PROD_WITH_APP_PROFILE_ID = '66666666-6666-4666-a666-666666666666'

const STRANGER_PROD_USER_ID = '77777777-7777-4777-a777-777777777777'
const STRANGER_PROD_PROFILE_ID = '88888888-8888-4888-a888-888888888888'

const MOCK_CREDIT_ID = '99999999-9999-4999-a999-999999999999'

let currentCaller = {
  userId: TALENT_USER_ID,
  role: 'talent' as 'talent' | 'production',
  profileId: TALENT_PROFILE_ID,
  talentProfileId: TALENT_PROFILE_ID as string | null,
  productionProfileId: null as string | null,
}

// ── In-Memory DB Stores ────────────────────────────────────────
interface MockTalentProfile {
  id: string
  user_id: string
  full_name: string
  role: string | null
  roles: string[]
  bio: string | null
  skills: string[]
  experience_years: number
  language: string | null
  location: string | null
  avatar_url: string | null
  portfolio_url: string | null
  showreel_url: string | null
  availability: 'open' | 'busy' | 'unavailable'
  resume_path: string | null
  last_active_at: string
  created_at: string
}

let mockProfiles: MockTalentProfile[] = []
let mockCredits: Array<{
  id: string
  talent_profile_id: string
  project_title: string
  role: string
  year: number | null
  production_company: string | null
  description: string | null
  link: string | null
  created_at: string
}> = []
let mockApplications: Array<{
  id: string
  job_id: string
  talent_profile_id: string
  production_id: string
}> = []

let storageFiles: Record<string, Buffer> = {}

// ── Mock Supabase ─────────────────────────────────────────────
vi.mock('../../db/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'talent_profiles') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              single: async () => {
                const found = mockProfiles.find(p => (p as any)[col] === val)
                return found ? { data: { ...found }, error: null } : { data: null, error: { message: 'Not found' } }
              },
              maybeSingle: async () => {
                const found = mockProfiles.find(p => (p as any)[col] === val)
                return { data: found ? { ...found } : null, error: null }
              },
            }),
            order: () => ({
              range: (from: number, to: number) => ({
                overlaps: () => ({ data: mockProfiles.slice(from, to + 1), error: null }),
                or: () => ({ data: mockProfiles.slice(from, to + 1), error: null }),
                ilike: () => ({ data: mockProfiles.slice(from, to + 1), error: null }),
                eq: (_c: string, v: string) => ({
                  data: mockProfiles.filter(p => p.availability === v).slice(from, to + 1),
                  error: null,
                }),
              }),
            }),
          }),
          update: (payload: any) => ({
            eq: (col: string, val: string) => {
              const idx = mockProfiles.findIndex(p => (p as any)[col] === val)
              if (idx !== -1) {
                mockProfiles[idx] = { ...mockProfiles[idx], ...payload }
                return {
                  select: () => ({
                    single: async () => ({ data: { ...mockProfiles[idx] }, error: null }),
                    maybeSingle: async () => ({ data: { ...mockProfiles[idx] }, error: null }),
                  }),
                  error: null,
                }
              }
              return { select: () => ({ single: async () => ({ data: null, error: { message: 'Not found' } }) }), error: { message: 'Not found' } }
            },
          }),
          insert: (payload: any) => ({
            select: () => ({
              single: async () => {
                const created: MockTalentProfile = {
                  id: `tp-${Date.now()}`,
                  created_at: new Date().toISOString(),
                  last_active_at: new Date().toISOString(),
                  ...payload,
                }
                mockProfiles.push(created)
                return { data: created, error: null }
              },
            }),
          }),
        }
      }

      if (table === 'talent_credits') {
        return {
          select: (_cols?: string, opts?: { count?: string; head?: boolean }) => ({
            eq: (_col: string, val: string) => {
              const filtered = mockCredits.filter(c => c.talent_profile_id === val)
              if (opts?.count === 'exact') {
                return { count: filtered.length, error: null, data: opts.head ? null : filtered }
              }
              return {
                order: () => ({
                  order: () => Promise.resolve({ data: [...filtered], error: null }),
                  then: (resolve: any) => resolve({ data: [...filtered], error: null }),
                }),
                then: (resolve: any) => resolve({ data: [...filtered], error: null }),
              }
            },
          }),
          insert: (payload: any) => ({
            select: () => ({
              single: async () => {
                const newCredit = {
                  id: `credit-${Date.now()}-${Math.random()}`,
                  created_at: new Date().toISOString(),
                  ...payload,
                }
                mockCredits.push(newCredit)
                return { data: newCredit, error: null }
              },
            }),
          }),
          update: (payload: any) => ({
            eq: (col1: string, val1: string) => ({
              eq: (col2: string, val2: string) => ({
                select: () => ({
                  maybeSingle: async () => {
                    const idx = mockCredits.findIndex(
                      c => (c as any)[col1] === val1 && (c as any)[col2] === val2
                    )
                    if (idx !== -1) {
                      mockCredits[idx] = { ...mockCredits[idx], ...payload }
                      return { data: { ...mockCredits[idx] }, error: null }
                    }
                    return { data: null, error: { message: 'Credit not found' } }
                  },
                }),
              }),
            }),
          }),
          delete: (_opts?: any) => ({
            eq: (col1: string, val1: string) => ({
              eq: async (col2: string, val2: string) => {
                const before = mockCredits.length
                mockCredits = mockCredits.filter(
                  c => !((c as any)[col1] === val1 && (c as any)[col2] === val2)
                )
                const deletedCount = before - mockCredits.length
                return { error: null, count: deletedCount }
              },
            }),
          }),
        }
      }

      if (table === 'applications') {
        return {
          select: (_cols: string) => ({
            eq: (_c1: string, val1: string) => ({
              eq: (_c2: string, val2: string) => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const found = mockApplications.find(
                      a => a.talent_profile_id === val1 && a.production_id === val2
                    )
                    return { data: found ? { id: found.id } : null, error: null }
                  },
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'match_recompute_queue') {
        return {
          insert: async () => ({ error: null }),
        }
      }

      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, buffer: Buffer) => {
          storageFiles[`${bucket}/${path}`] = buffer
          return { data: { path }, error: null }
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://mock.storage/${bucket}/${path}` },
        }),
        createSignedUrl: async (path: string, _expiresIn: number) => {
          return {
            data: { signedUrl: `https://mock.storage/${bucket}/${path}?signed_token=valid` },
            error: null,
          }
        },
        remove: async (paths: string[]) => {
          for (const p of paths) {
            delete storageFiles[`${bucket}/${p}`]
          }
          return { data: paths, error: null }
        },
      }),
    },
  },
}))

// ── Mock Auth & Caller Context Middleware ─────────────────────
vi.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: currentCaller.userId }
    next()
  },
}))

vi.mock('../../middleware/callerContext', () => ({
  loadCallerContext: (req: Request, _res: Response, next: NextFunction) => {
    req.caller = { ...currentCaller }
    next()
  },
}))

// ── Express Test App ──────────────────────────────────────────
const app = express()
app.use(express.json())
app.use('/talent', talentRouter)
app.use(errorHandler)

describe('Milestone M3: Talent Depth & Secure Uploads Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storageFiles = {}
    mockProfiles = [
      {
        id: TALENT_PROFILE_ID,
        user_id: TALENT_USER_ID,
        full_name: 'Priya Cine',
        role: 'Cinematographer',
        roles: ['Cinematographer', 'Colorist'],
        bio: 'Award winning cinematographer',
        skills: ['Lighting', 'Camera Ops'],
        experience_years: 5,
        language: 'Hindi',
        location: 'Mumbai',
        avatar_url: 'https://mock.storage/avatars/priya.jpg',
        portfolio_url: 'https://priya.film',
        showreel_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        availability: 'open',
        resume_path: 'resumes/priya_resume.pdf',
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: OTHER_TALENT_PROFILE_ID,
        user_id: OTHER_TALENT_USER_ID,
        full_name: 'Rahul Actor',
        role: 'Actor',
        roles: ['Actor'],
        bio: 'Theatre and screen actor',
        skills: ['Method Acting', 'Voiceover'],
        experience_years: 3,
        language: 'English',
        location: 'Delhi',
        avatar_url: null,
        portfolio_url: null,
        showreel_url: null,
        availability: 'busy',
        resume_path: null, // no resume
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]

    mockCredits = [
      {
        id: MOCK_CREDIT_ID,
        talent_profile_id: TALENT_PROFILE_ID,
        project_title: 'Gully Boy',
        role: 'Assistant Camera',
        year: 2019,
        production_company: 'Excel Entertainment',
        description: 'Focus puller on second unit',
        link: 'https://imdb.com/title/123',
        created_at: new Date().toISOString(),
      },
    ]

    mockApplications = [
      {
        id: 'app-1',
        job_id: 'job-100',
        talent_profile_id: TALENT_PROFILE_ID,
        production_id: PROD_WITH_APP_PROFILE_ID,
      },
    ]

    // Default caller: owner talent
    currentCaller = {
      userId: TALENT_USER_ID,
      role: 'talent',
      profileId: TALENT_PROFILE_ID,
      talentProfileId: TALENT_PROFILE_ID,
      productionProfileId: null,
    }
  })

  // ────────────────────────────────────────────────────────────
  // 1. Magic Bytes Sniffing & Validator Functions
  // ────────────────────────────────────────────────────────────
  describe('Binary Magic Bytes Sniffing & Upload Validators', () => {
    it('sniffs JPEG, PNG, WebP, and PDF magic bytes correctly', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      expect(sniffMagicBytes(jpegBuf)).toBe('jpeg')

      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
      expect(sniffMagicBytes(pngBuf)).toBe('png')

      const webpBuf = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP', 'ascii'),
      ])
      expect(sniffMagicBytes(webpBuf)).toBe('webp')

      const pdfBuf = Buffer.from('%PDF-1.4\n1 0 obj\n')
      expect(sniffMagicBytes(pdfBuf)).toBe('pdf')
    })

    it('sniffs and flags SVG content inside buffers (prevents stored XSS)', () => {
      const svg1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      expect(sniffMagicBytes(svg1)).toBe('svg')

      const svg2 = Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 100 100"></svg>')
      expect(sniffMagicBytes(svg2)).toBe('svg')
    })

    it('validateAvatarUpload rejects spoofed SVG disguised as image/png', () => {
      const spoofedSvg = {
        mimetype: 'image/png', // spoofed header!
        size: 500,
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>'),
        originalname: 'innocent.png',
      }
      const res = validateAvatarUpload(spoofedSvg)
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/SVG uploads are strictly disallowed/i)
    })

    it('validateAvatarUpload rejects file exceeding 2 MB', () => {
      const oversized = {
        mimetype: 'image/jpeg',
        size: 2.1 * 1024 * 1024,
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        originalname: 'huge.jpg',
      }
      const res = validateAvatarUpload(oversized)
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/exceeds the 2 MB limit/i)
    })

    it('validateResumeUpload rejects file exceeding 5 MB', () => {
      const oversized = {
        mimetype: 'application/pdf',
        size: 5.5 * 1024 * 1024,
        buffer: Buffer.from('%PDF-1.4'),
        originalname: 'big_resume.pdf',
      }
      const res = validateResumeUpload(oversized)
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/exceeds the 5 MB limit/i)
    })

    it('validateResumeUpload rejects spoofed non-PDF files', () => {
      const fakePdf = {
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('NOT A REAL PDF FILE CONTENTS'),
        originalname: 'cv.pdf',
      }
      const res = validateResumeUpload(fakePdf)
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/not a valid PDF document/i)
    })
  })

  // ────────────────────────────────────────────────────────────
  // 2. Avatar Upload HTTP Endpoint
  // ────────────────────────────────────────────────────────────
  describe('POST /talent/avatar Endpoint', () => {
    it('accepts valid PNG and updates avatar_url', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])

      const res = await request(app)
        .post('/talent/avatar')
        .attach('avatar', pngBuffer, 'photo.png')

      expect(res.status).toBe(200)
      expect(res.body.avatar_url).toBeDefined()
      expect(res.body.avatar_url).toContain('https://mock.storage/avatars')
    })

    it('rejects spoofed SVG disguised with .jpg filename and image/jpeg Content-Type', async () => {
      const evilSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>')

      const res = await request(app)
        .post('/talent/avatar')
        .attach('avatar', evilSvg, { filename: 'avatar.jpg', contentType: 'image/jpeg' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/SVG uploads are strictly disallowed/i)
    })

    it('rejects non-image file type (e.g. text file)', async () => {
      const txt = Buffer.from('hello world')
      const res = await request(app)
        .post('/talent/avatar')
        .attach('avatar', txt, { filename: 'note.txt', contentType: 'text/plain' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/unsupported file type/i)
    })

    it('rejects production accounts attempting to upload talent avatar', async () => {
      currentCaller = {
        userId: PROD_WITH_APP_USER_ID,
        role: 'production',
        profileId: PROD_WITH_APP_PROFILE_ID,
        talentProfileId: null,
        productionProfileId: PROD_WITH_APP_PROFILE_ID,
      }

      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
      const res = await request(app)
        .post('/talent/avatar')
        .attach('avatar', pngBuffer, 'photo.png')

      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/talent account required/i)
    })
  })

  // ────────────────────────────────────────────────────────────
  // 3. Resume Upload & Deletion HTTP Endpoints
  // ────────────────────────────────────────────────────────────
  describe('POST /talent/resume & DELETE /talent/resume Endpoints', () => {
    it('accepts valid PDF resume and saves to private bucket', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')

      const res = await request(app)
        .post('/talent/resume')
        .attach('resume', pdfBuffer, 'priya_resume.pdf')

      expect(res.status).toBe(200)
      expect(res.body.resume_path).toBeDefined()
      expect(res.body.message).toMatch(/resume uploaded successfully/i)
    })

    it('rejects non-PDF files uploaded to resume endpoint', async () => {
      const docx = Buffer.from('PK\x03\x04 fake docx bytes')

      const res = await request(app)
        .post('/talent/resume')
        .attach('resume', docx, { filename: 'resume.docx', contentType: 'application/vnd.openxmlformats' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/resumes must be PDF format/i)
    })

    it('DELETE /talent/resume removes resume path', async () => {
      const res = await request(app).delete('/talent/resume')
      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/resume deleted successfully/i)

      const profile = mockProfiles.find(p => p.id === TALENT_PROFILE_ID)
      expect(profile?.resume_path).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────
  // 4. Signed URL Authorization Rules
  // ────────────────────────────────────────────────────────────
  describe('GET /talent/:id/resume-url Access Control Rules', () => {
    it('allows the talent owner to generate a signed URL for their own resume', async () => {
      currentCaller = {
        userId: TALENT_USER_ID,
        role: 'talent',
        profileId: TALENT_PROFILE_ID,
        talentProfileId: TALENT_PROFILE_ID,
        productionProfileId: null,
      }

      const res = await request(app).get(`/talent/${TALENT_PROFILE_ID}/resume-url`)
      expect(res.status).toBe(200)
      expect(res.body.signed_url).toContain('https://mock.storage/resumes')
      expect(res.body.expires_in).toBe(60)
    })

    it('allows a production user who received an application to get signed URL', async () => {
      currentCaller = {
        userId: PROD_WITH_APP_USER_ID,
        role: 'production',
        profileId: PROD_WITH_APP_PROFILE_ID,
        talentProfileId: null,
        productionProfileId: PROD_WITH_APP_PROFILE_ID,
      }

      const res = await request(app).get(`/talent/${TALENT_PROFILE_ID}/resume-url`)
      expect(res.status).toBe(200)
      expect(res.body.signed_url).toContain('https://mock.storage/resumes')
      expect(res.body.expires_in).toBe(60)
    })

    it('rejects a stranger production user who has NOT received an application (403)', async () => {
      currentCaller = {
        userId: STRANGER_PROD_USER_ID,
        role: 'production',
        profileId: STRANGER_PROD_PROFILE_ID,
        talentProfileId: null,
        productionProfileId: STRANGER_PROD_PROFILE_ID,
      }

      const res = await request(app).get(`/talent/${TALENT_PROFILE_ID}/resume-url`)
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/active application/i)
    })

    it('rejects another talent user attempting to read someone else’s resume (403)', async () => {
      currentCaller = {
        userId: OTHER_TALENT_USER_ID,
        role: 'talent',
        profileId: OTHER_TALENT_PROFILE_ID,
        talentProfileId: OTHER_TALENT_PROFILE_ID,
        productionProfileId: null,
      }

      const res = await request(app).get(`/talent/${TALENT_PROFILE_ID}/resume-url`)
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/active application/i)
    })

    it('returns 404 if talent has not uploaded a resume', async () => {
      currentCaller = {
        userId: OTHER_TALENT_USER_ID,
        role: 'talent',
        profileId: OTHER_TALENT_PROFILE_ID,
        talentProfileId: OTHER_TALENT_PROFILE_ID,
        productionProfileId: null,
      }

      const res = await request(app).get(`/talent/${OTHER_TALENT_PROFILE_ID}/resume-url`)
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/no resume uploaded/i)
    })
  })

  // ────────────────────────────────────────────────────────────
  // 5. Credits CRUD & Max 50 Limit
  // ────────────────────────────────────────────────────────────
  describe('Talent Credits CRUD & Authorization', () => {
    it('creates a new credit for talent owner (POST /talent/credits)', async () => {
      const newCredit = {
        project_title: 'Dangal',
        role: 'Focus Puller',
        year: 2016,
        production_company: 'Aamir Khan Productions',
        description: 'Worked on wrestling training sequences',
        link: 'https://imdb.com/title/456',
      }

      const res = await request(app)
        .post('/talent/credits')
        .send(newCredit)

      expect(res.status).toBe(201)
      expect(res.body.credit.project_title).toBe('Dangal')
      expect(res.body.credit.role).toBe('Focus Puller')
      expect(res.body.credit.year).toBe(2016)
    })

    it('rejects credit creation with missing required fields (400)', async () => {
      const res = await request(app)
        .post('/talent/credits')
        .send({ role: 'Assistant' }) // missing project_title

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/project_title|expected string/i)
    })

    it('rejects credit creation when max 50 credits limit is reached (400)', async () => {
      // Fill mockCredits with 50 credits for this profile
      for (let i = 0; i < 50; i++) {
        mockCredits.push({
          id: `bulk-${i}`,
          talent_profile_id: TALENT_PROFILE_ID,
          project_title: `Film ${i}`,
          role: 'Crew',
          year: 2020,
          production_company: null,
          description: null,
          link: null,
          created_at: new Date().toISOString(),
        })
      }

      const res = await request(app)
        .post('/talent/credits')
        .send({ project_title: '51st Film', role: 'Director' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/limit of 50 credits/i)
    })

    it('updates an existing credit (PUT /talent/credits/:id)', async () => {
      const res = await request(app)
        .put(`/talent/credits/${MOCK_CREDIT_ID}`)
        .send({ role: 'Lead Cinematographer', year: 2020 })

      expect(res.status).toBe(200)
      expect(res.body.credit.role).toBe('Lead Cinematographer')
      expect(res.body.credit.year).toBe(2020)
    })

    it('deletes an existing credit (DELETE /talent/credits/:id)', async () => {
      const res = await request(app).delete(`/talent/credits/${MOCK_CREDIT_ID}`)
      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/credit deleted successfully/i)

      expect(mockCredits.find(c => c.id === MOCK_CREDIT_ID)).toBeUndefined()
    })
  })

  // ────────────────────────────────────────────────────────────
  // 6. Availability Toggle & Search Filter
  // ────────────────────────────────────────────────────────────
  describe('Availability Status & Validation', () => {
    it('updates availability status to busy (PUT /talent/availability)', async () => {
      const res = await request(app)
        .put('/talent/availability')
        .send({ availability: 'busy' })

      expect(res.status).toBe(200)
      expect(res.body.availability).toBe('busy')
    })

    it('rejects invalid availability values (400)', async () => {
      const res = await request(app)
        .put('/talent/availability')
        .send({ availability: 'on_vacation' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/availability must be/i)
    })
  })

  // ────────────────────────────────────────────────────────────
  // 7. Showreel URL Host Checking & Embed Generation
  // ────────────────────────────────────────────────────────────
  describe('Showreel Host Validation & Embed Conversion', () => {
    it('validates allowed YouTube and Vimeo hosts strictly', () => {
      expect(isValidShowreelUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      expect(isValidShowreelUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
      expect(isValidShowreelUrl('https://vimeo.com/76979871')).toBe(true)
      expect(isValidShowreelUrl('https://player.vimeo.com/video/76979871')).toBe(true)
    })

    it('rejects arbitrary iframe hosts and malicious URIs', () => {
      expect(isValidShowreelUrl('https://evil-site.com/video.mp4')).toBe(false)
      expect(isValidShowreelUrl('javascript:alert(1)')).toBe(false)
      expect(isValidShowreelUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isValidShowreelUrl('https://notyoutube.com/watch?v=123')).toBe(false)
    })

    it('generates sandboxed embed URLs matching CSP frame-src', () => {
      const ytEmbed = getShowreelEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(ytEmbed).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')

      const shortYtEmbed = getShowreelEmbedUrl('https://youtu.be/dQw4w9WgXcQ')
      expect(shortYtEmbed).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')

      const vimeoEmbed = getShowreelEmbedUrl('https://vimeo.com/76979871')
      expect(vimeoEmbed).toBe('https://player.vimeo.com/video/76979871')
    })

    it('PUT /talent/profile rejects arbitrary showreel host (400)', async () => {
      const res = await request(app)
        .put('/talent/profile')
        .send({ showreel_url: 'https://attacker.com/malicious.mp4' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/valid YouTube or Vimeo URL/i)
    })
  })

  // ────────────────────────────────────────────────────────────
  // 8. Match Engine: Secondary Roles & 10-Field Completeness
  // ────────────────────────────────────────────────────────────
  describe('Match Engine Scoring with Secondary Roles & 10-Field Completeness', () => {
    const job: JobForScoring = {
      skills: ['Lighting', 'Camera Ops'],
      roles: ['Colorist'],
      experience_level: 'mid',
      language: 'Hindi',
      location: 'Mumbai',
    }

    const talent: TalentForScoring = {
      full_name: 'Priya Sharma',
      bio: 'Award winning cinematographer and colorist',
      role: 'Cinematographer', // primary role is Cinematographer
      roles: ['Cinematographer', 'Colorist'], // secondary role Colorist matches job!
      skills: ['Lighting', 'Camera Ops'],
      experience_years: 4,
      language: 'Hindi',
      location: 'Mumbai',
      avatar_url: 'https://example.com/avatar.jpg',
      portfolio_url: 'https://priyasharma.film',
      showreel_url: 'https://youtube.com/watch?v=123',
      credits_count: 2,
      last_active_at: new Date().toISOString(),
    }

    it('role match passes at 100% when secondary role matches job role', () => {
      const breakdown = calculateMatchScore(job, talent)
      expect(breakdown.signals.role_match).toBe(100)
      expect(breakdown.reasons.role_match).toContain('Secondary role matches requirement: Colorist')
    })

    it('completeness equals 100% when all 10 fields are filled', () => {
      const breakdown = calculateMatchScore(job, talent)
      expect(breakdown.signals.profile_completeness).toBe(100)
      expect(breakdown.total).toBe(100)
    })

    it('completeness drops by 10% without showreel and 10% without credits', () => {
      const noMedia = { ...talent, showreel_url: null, credits_count: 0 }
      const breakdown = calculateMatchScore(job, noMedia)
      // 8/10 fields = 80%
      expect(breakdown.signals.profile_completeness).toBe(80)
    })
  })
})
