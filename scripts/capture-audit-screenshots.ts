import { chromium } from 'playwright'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

const PORT = 5198
const TARGET_DIR = process.argv[2] === 'after' ? 'docs/design/after' : 'docs/design/before'
const BASE_URL = `http://localhost:${PORT}`

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 900 },
]

const PAGES = [
  { name: 'landing', route: '/', role: null },
  { name: 'login', route: '/login', role: null },
  { name: 'register', route: '/register', role: null },
  { name: 'verify', route: '/verify', role: null },
  { name: 'resetpassword', route: '/reset-password', role: null },
  { name: 'privacy', route: '/privacy', role: null },
  { name: 'terms', route: '/terms', role: null },
  { name: 'cookies', route: '/cookies', role: null },
  { name: 'contact', route: '/contact', role: null },
  { name: 'unsubscribe', route: '/unsubscribe/sample-token', role: null },
  { name: 'notfound', route: '/non-existent-page', role: null },
  { name: 'browsejobs', route: '/jobs', role: null },
  { name: 'companydetail', route: '/company/comp-1', role: null },
  { name: 'home', route: '/home', role: 'production' },
  { name: 'createprofile', route: '/create-profile', role: 'production' },
  { name: 'createjob', route: '/jobs/create', role: 'production' },
  { name: 'editjob', route: '/jobs/job-1/edit', role: 'production' },
  { name: 'jobdetail', route: '/jobs/job-1', role: 'production' },
  { name: 'applications', route: '/applications', role: 'production' },
  { name: 'search', route: '/search', role: 'production' },
  { name: 'chat', route: '/chat', role: 'production' },
  { name: 'profile', route: '/profile', role: 'talent' },
  { name: 'settings', route: '/settings', role: 'production' },
  { name: 'admin', route: '/admin', role: 'production' },
  { name: 'alerts', route: '/alerts', role: 'production' },
  { name: 'savedjobs', route: '/saved-jobs', role: 'talent' },
  { name: 'design', route: '/design', role: null },
]

const COMPONENTS = [
  { name: 'autocompleteinput', selector: '#comp-autocomplete-input' },
  { name: 'autocompletetaginput', selector: '#comp-autocomplete-tag-input' },
  { name: 'notificationbell', selector: '#comp-notification-bell' },
  { name: 'verifiedbadge', selector: '#comp-verified-badge' },
  { name: 'protectedroute', selector: '#comp-protected-route-loader' },
  { name: 'publicfooter', selector: '#comp-public-footer' },
]

// Mock data generator for network requests
function getMockResponse(rawUrl: string) {
  const url = rawUrl.replace('/api', '')

  if (url.includes('/dashboard/stats')) {
    return {
      active_jobs: 3,
      new_applications: 12,
      recommended_talent: 8,
      unread_notifications: 2,
    }
  }

  if (url.includes('/notifications/unread-count')) {
    return { count: 2 }
  }

  if (url.includes('/jobs/job-1') || url.includes('/jobs/detail')) {
    const jobData = {
      id: 'job-1',
      title: 'Director of Photography',
      description: 'Looking for an experienced DP for a 20-day indie feature film shooting in Mumbai and Goa. Must have experience with ARRI Alexa Mini LF and Cooke anamorphic lenses.',
      role: 'Cinematographer',
      department: 'Camera',
      job_type: 'contract',
      location: 'Mumbai, Maharashtra',
      experience_min: 4,
      pay_min: 150000,
      pay_max: 250000,
      pay_currency: 'INR',
      pay_unit: 'month',
      status: 'published',
      published_at: '2026-03-10T10:00:00Z',
      skills: ['ARRI Alexa', 'Lighting Design', 'Anamorphic Lenses', 'Color Theory'],
      production: {
        id: 'comp-1',
        company_name: 'Dharma Motion Pictures',
        verified: true,
        logo_url: null,
      },
      production_profiles: {
        id: 'comp-1',
        company_name: 'Dharma Motion Pictures',
        verified: true,
        logo_url: null,
      },
    }
    return { job: jobData, ...jobData }
  }

  if (url.includes('/saved-jobs')) {
    return {
      saved: [
        {
          id: 'job-1',
          title: 'Director of Photography',
          role: 'Cinematographer',
          department: 'Camera',
          location: 'Mumbai, MH',
          status: 'published',
          production_company: 'Dharma Motion Pictures',
        },
      ],
    }
  }

  if (url.includes('/applications')) {
    return {
      applications: [
        {
          id: 'app-1',
          job_id: 'job-1',
          talent_profile_id: 'talent-1',
          cover_note: 'Award-winning cinematographer with 8 feature films shot on ARRI Alexa Mini LF.',
          status: 'applied',
          match_score: 95,
          matching_skills: ['ARRI Alexa', 'Lighting Design'],
          missing_skills: [],
          summary_reasons: ['Extensive feature film camera experience', 'Matched 2 of 2 required camera skills'],
          score_breakdown: {
            skills_match: 30,
            role_match: 20,
            experience_match: 15,
            language_match: 10,
            location_proximity: 10,
            profile_completeness: 5,
            activity_recency: 5,
          },
          applied_at: '2026-03-11T12:00:00Z',
          created_at: '2026-03-11T12:00:00Z',
          talent_profiles: {
            id: 'talent-1',
            user_id: 'usr-1',
            full_name: 'Priya Sharma',
            role: 'Cinematographer',
            skills: ['ARRI Alexa', 'Lighting Design', 'Anamorphic Lenses'],
            experience_years: 8,
            location: 'Mumbai, Maharashtra',
            availability: 'open',
            showreel_url: 'https://vimeo.com/12345678',
            avatar_url: null,
          },
        },
        {
          id: 'app-2',
          job_id: 'job-1',
          talent_profile_id: 'talent-2',
          cover_note: 'Steadicam specialist experienced in fast-paced commercial and drama shoots.',
          status: 'shortlisted',
          match_score: 88,
          matching_skills: ['Lighting Design'],
          missing_skills: ['ARRI Alexa'],
          summary_reasons: ['Strong lighting and rigging background', 'Local Mumbai resident available now'],
          score_breakdown: {
            skills_match: 22,
            role_match: 20,
            experience_match: 15,
            language_match: 10,
            location_proximity: 10,
            profile_completeness: 5,
            activity_recency: 6,
          },
          applied_at: '2026-03-10T15:30:00Z',
          created_at: '2026-03-10T15:30:00Z',
          talent_profiles: {
            id: 'talent-2',
            user_id: 'usr-2',
            full_name: 'Rahul Verma',
            role: 'Camera Operator',
            skills: ['Lighting Design', 'Steadicam Archer 2'],
            experience_years: 5,
            location: 'Mumbai, Maharashtra',
            availability: 'within_2_weeks',
            showreel_url: 'https://vimeo.com/87654321',
            avatar_url: null,
          },
        },
        {
          id: 'app-3',
          job_id: 'job-1',
          talent_profile_id: 'talent-3',
          cover_note: 'Chief lighting technician with 6 indie features completed.',
          status: 'interview',
          interview_at: '2026-10-15T14:00:00Z',
          match_score: 82,
          matching_skills: ['Lighting Design'],
          missing_skills: [],
          summary_reasons: ['High lighting proficiency', 'Available immediately'],
          score_breakdown: {
            skills_match: 20,
            role_match: 17,
            experience_match: 15,
            language_match: 10,
            location_proximity: 10,
            profile_completeness: 5,
            activity_recency: 5,
          },
          applied_at: '2026-03-09T11:20:00Z',
          created_at: '2026-03-09T11:20:00Z',
          talent_profiles: {
            id: 'talent-3',
            user_id: 'usr-3',
            full_name: 'Amit Kumar',
            role: 'Gaffer',
            skills: ['Lighting Design', 'Grip Operations'],
            experience_years: 6,
            location: 'Pune, Maharashtra',
            availability: 'open',
            showreel_url: null,
            avatar_url: null,
          },
        },
        {
          id: 'app-4',
          job_id: 'job-1',
          talent_profile_id: 'talent-4',
          cover_note: 'Senior Director of Photography with Cooke anamorphic lens package.',
          status: 'hired',
          match_score: 96,
          matching_skills: ['ARRI Alexa', 'Lighting Design'],
          missing_skills: [],
          summary_reasons: ['Perfect technical kit match', 'Over 10 years experience'],
          score_breakdown: {
            skills_match: 30,
            role_match: 20,
            experience_match: 15,
            language_match: 10,
            location_proximity: 10,
            profile_completeness: 6,
            activity_recency: 5,
          },
          applied_at: '2026-03-08T09:10:00Z',
          created_at: '2026-03-08T09:10:00Z',
          talent_profiles: {
            id: 'talent-4',
            user_id: 'usr-4',
            full_name: 'Sneha Patel',
            role: 'Cinematographer',
            skills: ['ARRI Alexa', 'Lighting Design', 'Color Grading'],
            experience_years: 11,
            location: 'Mumbai, Maharashtra',
            availability: 'open',
            showreel_url: 'https://vimeo.com/99887766',
            avatar_url: null,
          },
        },
        {
          id: 'app-5',
          job_id: 'job-1',
          talent_profile_id: 'talent-5',
          cover_note: 'Sound engineer applying to camera department.',
          status: 'rejected',
          match_score: 42,
          matching_skills: [],
          missing_skills: ['ARRI Alexa', 'Lighting Design'],
          summary_reasons: ['Mismatch between required camera role and background'],
          score_breakdown: {
            skills_match: 10,
            role_match: 10,
            experience_match: 7,
            language_match: 5,
            location_proximity: 5,
            profile_completeness: 5,
            activity_recency: 0,
          },
          applied_at: '2026-03-07T14:45:00Z',
          created_at: '2026-03-07T14:45:00Z',
          talent_profiles: {
            id: 'talent-5',
            user_id: 'usr-5',
            full_name: 'Vikram Das',
            role: 'Sound Mixer',
            skills: ['Boom Operations'],
            experience_years: 2,
            location: 'Kolkata, West Bengal',
            availability: 'unavailable',
            showreel_url: null,
            avatar_url: null,
          },
        },
      ],
      total: 5,
    }
  }

  if (url.includes('/jobs')) {
    return {
      jobs: [
        {
          id: 'job-1',
          title: 'Director of Photography',
          role: 'Cinematographer',
          department: 'Camera',
          job_type: 'contract',
          location: 'Mumbai, MH',
          pay_min: 150000,
          pay_max: 250000,
          pay_currency: 'INR',
          pay_unit: 'project',
          status: 'published',
          published_at: '2026-03-10T10:00:00Z',
          skills: ['ARRI Alexa', 'Lighting Design'],
          production_company: 'Dharma Motion Pictures',
          company_name: 'Dharma Motion Pictures',
          match_score: 92,
        },
        {
          id: 'job-2',
          title: 'Chief Sound Designer',
          role: 'Sound Designer',
          department: 'Sound',
          job_type: 'freelance',
          location: 'Hyderabad, TS',
          pay_min: 80000,
          pay_max: 120000,
          pay_currency: 'INR',
          pay_unit: 'project',
          status: 'published',
          published_at: '2026-03-08T10:00:00Z',
          skills: ['Pro Tools', 'Foley', 'Dolby Atmos'],
          production_company: 'Mythri Makers',
          company_name: 'Mythri Makers',
          match_score: 78,
        },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    }
  }

  if (url.includes('/production/comp-1') || url.includes('/production/profile') || url.includes('/production/')) {
    return {
      profile: {
        id: 'comp-1',
        company_name: 'Dharma Motion Pictures',
        bio: 'Premier feature film and streaming production studio based in Mumbai with over 25 feature films produced across Hindi, Telugu, and international cinema.',
        production_details: 'Equipped with dual ARRI Alexa Mini LF packages, Master Anamorphic prime kits, and in-house sound recording facilities.',
        verified: true,
        verified_at: '2025-01-15T00:00:00Z',
        created_at: '2025-01-15T00:00:00Z',
        logo_url: null,
      },
      jobs: [
        {
          id: 'job-1',
          production_id: 'comp-1',
          title: 'Director of Photography',
          role: 'Cinematographer',
          department: 'Camera',
          location: 'Mumbai, Maharashtra',
          status: 'published',
          job_type: 'contract',
          pay_min: 150000,
          pay_max: 250000,
          pay_currency: 'INR',
          pay_period: 'project',
          created_at: '2026-03-10T10:00:00Z',
        },
        {
          id: 'job-2',
          production_id: 'comp-1',
          title: 'Costume Designer',
          role: 'Costume Designer',
          department: 'Art and Costume',
          location: 'Mumbai, Maharashtra',
          status: 'published',
          job_type: 'contract',
          pay_min: 80000,
          pay_max: 120000,
          pay_currency: 'INR',
          pay_period: 'project',
          created_at: '2026-03-08T10:00:00Z',
        },
      ],
    }
  }

  if (url.includes('/talent/search')) {
    return {
      talent: [
        {
          id: 'talent-1',
          full_name: 'Aditya Roy',
          role: 'Director of Photography',
          roles: ['Director of Photography', 'Colorist'],
          skills: ['ARRI Alexa', 'Lighting Design', 'Anamorphic Lenses', 'Color Grading'],
          experience_years: 8,
          location: 'Mumbai',
          language: 'Hindi, English',
          availability: 'open',
          last_active_at: '2026-03-11T12:00:00Z',
        },
        {
          id: 'talent-2',
          full_name: 'Rahul Verma',
          role: 'Steadicam Operator',
          roles: ['Steadicam Operator', 'Camera Operator'],
          skills: ['Steadicam Archer 2', 'Lighting Design'],
          experience_years: 5,
          location: 'Hyderabad',
          language: 'Telugu, Hindi',
          availability: 'open',
          last_active_at: '2026-03-10T15:30:00Z',
        },
        {
          id: 'talent-3',
          full_name: 'Amit Kumar',
          role: 'Gaffer',
          roles: ['Gaffer', 'Key Grip'],
          skills: ['Lighting Design', 'Grip Operations'],
          experience_years: 6,
          location: 'Pune',
          language: 'Marathi, Hindi',
          availability: 'busy',
          last_active_at: '2026-03-09T11:20:00Z',
        },
      ],
    }
  }

  if (url.includes('/talent')) {
    return {
      profile: {
        id: 'talent-1',
        user_id: 'usr-test-123',
        full_name: 'Aditya Roy',
        bio: 'Award-winning cinematographer and camera operator with over 8 years of experience across narrative feature films, independent drama, and high-end commercials. Specialized in large-format sensor workflows and anamorphic optics.',
        role: 'Director of Photography',
        roles: ['Director of Photography', 'Steadicam Operator', 'Colorist'],
        experience_years: 8,
        location: 'Mumbai',
        language: 'Hindi, English',
        skills: ['ARRI Alexa', 'Lighting Design', 'Anamorphic Lenses', 'Color Grading', 'DaVinci Resolve', 'Steadicam'],
        verified: false,
        portfolio_url: 'https://adityaroyfilms.test',
        showreel_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        availability: 'open',
        has_resume: true,
        credits: [
          { id: 'c-1', project_title: 'Shadows in the Mist', role: 'Director of Photography', year: 2024, production_company: 'Excel Entertainment', link: 'https://film.test/shadows' },
          { id: 'c-2', project_title: 'Monsoon Light', role: 'Director of Photography', year: 2023, production_company: 'Indie Wave Studios', link: 'https://film.test/monsoon' },
          { id: 'c-3', project_title: 'Bombay Velvet Dreams', role: 'Camera Operator', year: 2022, production_company: 'Phantom Films', link: 'https://film.test/bombay' },
        ],
      },
    }
  }

  if (url.includes('/api/applications')) {
    return {
      applications: [
        {
          id: 'app-1',
          job_id: 'job-1',
          job_title: 'Director of Photography',
          talent_id: 'talent-1',
          talent_name: 'Aditya Roy',
          talent_role: 'Cinematographer',
          status: 'shortlisted',
          match_score: 92,
          created_at: '2026-03-11T12:00:00Z',
        },
      ],
      total: 1,
    }
  }

  if (url.includes('/api/notifications')) {
    return {
      notifications: [
        {
          id: 'notif-1',
          type: 'new_application',
          created_at: '2026-03-11T14:30:00Z',
          is_read: false,
          payload: { talent_name: 'Aditya Roy', job_title: 'Director of Photography', job_id: 'job-1' },
        },
      ],
      unread_count: 1,
    }
  }

  if (url.includes('/api/chat/channels') || url.includes('/api/chat')) {
    return {
      channels: [
        {
          id: 'chan-1',
          peer_id: 'talent-1',
          peer_name: 'Aditya Roy',
          last_message: 'Looking forward to reviewing the script.',
          last_message_at: '2026-03-11T16:00:00Z',
          unread_count: 0,
        },
      ],
      messages: [
        {
          id: 'msg-1',
          sender_id: 'talent-1',
          recipient_id: 'comp-1',
          content: 'Hello, looking forward to discussing the shooting schedule.',
          created_at: '2026-03-11T15:00:00Z',
        },
      ],
    }
  }

  if (url.includes('/api/vocab/roles')) {
    return {
      roles: [
        { id: 'r1', name: 'Cinematographer', department: 'Camera' },
        { id: 'r2', name: 'Sound Designer', department: 'Sound' },
        { id: 'r3', name: 'Film Editor', department: 'Editing' },
        { id: 'r4', name: 'Costume Designer', department: 'Art and Costume' },
        { id: 'r5', name: 'Actor / Lead', department: 'Cast' },
        { id: 'r6', name: 'Line Producer', department: 'Production' },
      ],
    }
  }

  if (url.includes('/api/vocab/skills')) {
    return {
      skills: [
        { id: 's1', name: 'ARRI Alexa' },
        { id: 's2', name: 'Steadicam' },
        { id: 's3', name: 'Pro Tools' },
        { id: 's4', name: 'Color Grading' },
      ],
    }
  }

  if (url.includes('/api/vocab/cities')) {
    return {
      cities: [
        { id: 'c1', name: 'Mumbai', state: 'Maharashtra' },
        { id: 'c2', name: 'Hyderabad', state: 'Telangana' },
        { id: 'c3', name: 'Chennai', state: 'Tamil Nadu' },
      ],
    }
  }

  if (url.includes('/api/alerts')) {
    return {
      alerts: [
        {
          id: 'alt-1',
          title: 'New High Match: Camera Department',
          query: 'Role: Cinematographer, City: Mumbai',
          match_count: 5,
          active: true,
          created_at: '2026-03-01T00:00:00Z',
        },
      ],
    }
  }

  if (url.includes('/api/admin')) {
    return {
      stats: {
        total_users: 1420,
        total_talent: 980,
        total_productions: 440,
        verified_productions: 320,
        active_jobs: 84,
        total_applications: 3120,
      },
      verificationQueue: [],
      auditLogs: [],
    }
  }

  if (url.includes('/api/settings')) {
    return {
      notifications_email: true,
      notifications_push: false,
      privacy_level: 'public',
      theme: 'system',
    }
  }

  return { ok: true, data: [] }
}

async function run() {
  fs.mkdirSync(TARGET_DIR, { recursive: true })

  console.log(`Starting Vite server on port ${PORT}...`)
  const viteProc: ChildProcess = spawn('npx', ['vite', '--port', String(PORT)], {
    cwd: path.resolve(process.cwd(), 'client'),
    stdio: 'pipe',
    shell: true,
  })

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite start timeout')), 15000)
    viteProc.stdout?.on('data', (d) => {
      if (d.toString().includes('Local:') || d.toString().includes('ready in')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    viteProc.stderr?.on('data', (d) => {
      // console.error(d.toString())
    })
  })
  console.log('Vite server ready!')

  const browser = await chromium.launch({ headless: true })

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n=== Capturing Viewport: ${vp.width}x${vp.height} (${vp.name}px) ===\n`)
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()

      // Intercept network requests
      await page.route('**/*', async (route) => {
        const reqUrl = route.request().url()
        if (reqUrl.includes(':3000') || reqUrl.includes('/api/')) {
          const mock = getMockResponse(reqUrl)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify(mock),
          })
        } else {
          await route.continue()
        }
      })

      // Navigate to origin once to initialize localStorage context
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })

      // Capture all pages
      for (const p of PAGES) {
        console.log(`Capturing page: ${p.name} (${p.route}) @ ${vp.name}px`)
        
        // Initialize localStorage based on required role
        await page.evaluate((role) => {
          localStorage.clear()
          if (role) {
            localStorage.setItem('cc_access_token', 'mock-token-xyz')
            localStorage.setItem('cc_refresh_token', 'mock-refresh-token')
            localStorage.setItem('cc_user_id', 'usr-test-123')
            localStorage.setItem('cc_user_email', 'producer@dharmafilms.com')
            localStorage.setItem('cc_user_role', role)
            localStorage.setItem('cc_profile_id', role === 'production' ? 'comp-1' : 'talent-1')
          }
        }, p.role)

        try {
          await page.goto(`${BASE_URL}${p.route}`, { waitUntil: 'domcontentloaded', timeout: 12000 })
          await page.waitForTimeout(600)
        } catch {
          await page.waitForTimeout(1000)
        }

        const outPath = path.join(TARGET_DIR, `page-${p.name}-${vp.name}.png`)
        await page.screenshot({ path: outPath, fullPage: false })
      }

      // Capture shared components from /audit-components
      console.log(`Capturing shared components @ ${vp.name}px...`)
      await page.goto(`${BASE_URL}/audit-components`, { waitUntil: 'networkidle', timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(500)

      for (const c of COMPONENTS) {
        const el = await page.$(c.selector)
        const outPath = path.join(TARGET_DIR, `component-${c.name}-${vp.name}.png`)
        if (el) {
          await el.screenshot({ path: outPath })
          console.log(`  Saved component: ${c.name} -> ${outPath}`)
        } else {
          // If selector not found, screenshot full page as fallback
          await page.screenshot({ path: outPath })
          console.log(`  Warning: selector ${c.selector} not found, saved page fallback`)
        }
      }

      await context.close()
    }
    console.log(`\nAll screenshots successfully saved to ${TARGET_DIR}/!`)
  } finally {
    await browser.close()
    viteProc.kill()
  }
}

run().catch((err) => {
  console.error('Capture error:', err)
  process.exit(1)
})
