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
  { name: 'profile', route: '/profile', role: 'production' },
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

  if (url.includes('/production/comp-1') || url.includes('/production/')) {
    return {
      profile: {
        id: 'comp-1',
        company_name: 'Dharma Motion Pictures',
        bio: 'Premier feature film and streaming production studio based in Mumbai with over 25 feature films produced.',
        website: 'https://dharmamotion.in',
        verified: true,
        verified_at: '2025-01-15T00:00:00Z',
        cin: 'U92100MH2010PTC200111',
        gstin: '27AABCD1234F1Z5',
        contact_email: 'production@dharmamotion.in',
        location: 'Mumbai, Maharashtra',
        logo_url: null,
      },
      jobs: [
        {
          id: 'job-1',
          title: 'Director of Photography',
          role: 'Cinematographer',
          location: 'Mumbai, MH',
          status: 'published',
          job_type: 'contract',
          pay_min: 150000,
          pay_max: 250000,
          pay_currency: 'INR',
          created_at: '2026-03-10T10:00:00Z',
        },
      ],
    }
  }

  if (url.includes('/api/talent')) {
    return {
      profile: {
        id: 'talent-1',
        full_name: 'Aditya Roy Kapoor',
        stage_name: 'Aditya Roy',
        bio: 'Cinematographer and Steadicam operator with 8 feature films and 30+ commercials.',
        primary_role: 'Cinematographer',
        secondary_roles: ['Steadicam Operator', 'Camera Operator'],
        experience_years: 9,
        city: 'Mumbai',
        languages: ['English', 'Hindi', 'Marathi'],
        skills: ['ARRI Alexa Mini', 'RED V-Raptor', 'Steadicam Archer 2', 'DaVinci Resolve'],
        verified: true,
        imdb_url: 'https://imdb.com/name/nm1234567',
        showreel_url: 'https://vimeo.com/12345678',
      },
      credits: [
        { id: 'c-1', project_title: 'Shadows in the Mist', role: 'Director of Photography', year: 2024, production_house: 'Excel Entertainment' },
        { id: 'c-2', project_title: 'Bombay Velvet Dreams', role: 'Steadicam Operator', year: 2023, production_house: 'Phantom Films' },
      ],
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
