# CineConnect — Complete Technical Documentation

---

## 1. What Is CineConnect?

CineConnect is a two-sided marketplace for the film industry. It connects **Production Houses** (studios, directors, producers) with **Talent** (cinematographers, editors, sound engineers, actors, crew).

**Production houses** post jobs, review applicants, and move candidates through a hiring pipeline.  
**Talent** browse open jobs, apply with a cover note, and track their application status in real time.

The platform's core differentiator is a **7-signal match scoring engine** that automatically ranks every applicant against a job's requirements and gives production houses a 0–100% compatibility score.

---

## 2. Repository Structure

```
Cine_Connect/
├── client/                         # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NotificationBell.tsx   # Bell icon + realtime dropdown
│   │   │   └── ProtectedRoute.tsx     # Auth guard wrapper
│   │   ├── context/
│   │   │   └── AuthContext.tsx        # Global auth state (localStorage)
│   │   ├── hooks/
│   │   │   └── usePageTitle.ts        # Sets document.title per page
│   │   ├── lib/
│   │   │   ├── api.ts                 # All API calls + TypeScript types
│   │   │   └── supabase.ts            # Supabase browser client
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Verify.tsx
│   │   │   ├── CreateProfile.tsx
│   │   │   ├── Home.tsx               # Role-aware: production dashboard / talent browse
│   │   │   ├── JobDetail.tsx          # Single job + Apply modal + Bookmark
│   │   │   ├── CreateJob.tsx          # 3-step wizard
│   │   │   ├── Applications.tsx       # Pipeline + comparison modal
│   │   │   ├── Search.tsx             # Talent search with filter sidebar
│   │   │   ├── Chat.tsx               # Real-time messaging
│   │   │   ├── Profile.tsx            # View + inline edit + avatar upload
│   │   │   └── NotFound.tsx           # 404 page
│   │   ├── test/                      # Vitest + Testing Library tests
│   │   ├── App.tsx                    # Routes + lazy loading + Toaster
│   │   └── index.css                  # Tailwind base + component layer
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── vercel.json                    # Vercel deployment config
│
├── server/                         # Express backend
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── jobController.ts
│   │   │   ├── applicationsController.ts
│   │   │   ├── productionController.ts
│   │   │   ├── talentController.ts
│   │   │   ├── notificationsController.ts
│   │   │   └── dashboardController.ts
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts      # Bearer JWT → req.user
│   │   │   └── errorHandler.ts        # Centralised error handler
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── jobs.ts
│   │   │   ├── applications.ts
│   │   │   ├── production.ts
│   │   │   ├── talent.ts
│   │   │   ├── notifications.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── savedJobs.ts
│   │   │   └── talentAlerts.ts
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── jobService.ts
│   │   │   ├── applicationService.ts
│   │   │   ├── matchScore.ts          # The scoring engine
│   │   │   ├── talentService.ts
│   │   │   ├── productionProfileService.ts
│   │   │   ├── notificationService.ts
│   │   │   ├── dashboardService.ts
│   │   │   └── savedJobsService.ts
│   │   ├── db/
│   │   │   └── supabase.ts            # Admin client (service role key)
│   │   ├── types/
│   │   │   └── index.ts               # All shared TypeScript types
│   │   ├── utils/
│   │   │   └── sanitize.ts            # stripHtml + sanitizeObject
│   │   └── index.ts                   # Express app entry point
│   ├── Dockerfile
│   ├── fly.toml                       # Fly.io deployment config
│   └── vitest.config.mjs
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_jobs_schema.sql
│       ├── 003_talent_applications.sql
│       ├── 004_applications_pipeline.sql
│       ├── 005_notifications.sql
│       ├── 006_analytics_saved_alerts.sql
│       └── 007_email_notification_trigger.sql
│
├── scripts/
│   ├── validate-env.ts
│   ├── health-check.ts
│   └── build-check.sh
│
├── .github/workflows/ci.yml
├── docker-compose.yml
└── package.json                    # Workspace root (npm workspaces)
```

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 (custom design tokens) |
| Routing | React Router v6 (lazy loaded) |
| Icons | Lucide React |
| Toasts | Sonner |
| Auth (client) | Supabase JS (`signInWithPassword`, `resetPasswordForEmail`) |
| Realtime (client) | Supabase channels (`postgres_changes`) |
| Backend | Node.js + Express + TypeScript |
| Validation | Zod |
| Database | PostgreSQL via Supabase |
| Auth (server) | Supabase Admin SDK |
| Security | Helmet, express-rate-limit, CORS allowlist |
| Testing | Vitest, Supertest, @testing-library/react, happy-dom |
| CI/CD | GitHub Actions |
| Client deploy | Vercel |
| Server deploy | Fly.io (Mumbai region) |

---

## 4. Database Schema

### `public.users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | References `auth.users(id)` |
| email | text UNIQUE | |
| username | text UNIQUE | |
| role | text | CHECK: `talent` or `production` |
| created_at | timestamptz | |

### `public.production_profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | UNIQUE |
| company_name | text | |
| bio | text | nullable |
| production_details | text | nullable |
| logo_url | text | nullable |
| created_at | timestamptz | |

### `public.talent_profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | UNIQUE |
| full_name | text | nullable |
| bio | text | nullable |
| role | text | primary job title |
| skills | text[] | array of skill strings |
| experience_years | int | default 0 |
| language | text | nullable |
| location | text | nullable |
| avatar_url | text | nullable (Supabase Storage) |
| portfolio_url | text | nullable |
| last_active_at | timestamptz | updated on profile activity |
| created_at | timestamptz | |

### `public.jobs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| production_id | uuid FK → production_profiles | |
| title | text | |
| description | text | |
| status | text | CHECK: `draft`, `published`, `closed` |
| created_at | timestamptz | |

### `public.job_requirements`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | UNIQUE (one per job) |
| skills | text[] | required skills |
| roles | text[] | acceptable job titles |
| experience_level | text | `entry`, `mid`, `senior`, `any` |
| language | text | nullable |
| location | text | nullable |

### `public.applications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | |
| talent_profile_id | uuid FK → talent_profiles | |
| cover_note | text | nullable |
| status | text | CHECK: `applied`, `shortlisted`, `interview`, `hired`, `rejected` |
| match_score | numeric | computed at insert time |
| applied_at | timestamptz | |
| created_at | timestamptz | |
| UNIQUE | (job_id, talent_profile_id) | one application per job per talent |

### `public.notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | recipient |
| type | text | `new_application`, `new_message`, `high_match_talent` |
| payload | jsonb | contextual data |
| read | boolean | default false |
| created_at | timestamptz | |

### `public.messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| sender_id | uuid FK → users | |
| recipient_id | uuid FK → users | |
| body | text | |
| read | boolean | default false |
| created_at | timestamptz | |

### `public.saved_jobs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | |
| talent_profile_id | uuid FK → talent_profiles | |
| saved_at | timestamptz | |
| UNIQUE | (job_id, talent_profile_id) | |

### `public.job_views`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK → jobs | |
| viewer_id | uuid FK → users | nullable (anonymous) |
| viewed_at | timestamptz | |
| UNIQUE | (job_id, viewer_id) | one view per user per job |

### `public.talent_alerts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | who created the alert |
| label | text | e.g. "Mumbai Cinematographers" |
| skills | text[] | filter: any skill overlap |
| role | text | nullable, ilike match |
| location | text | nullable, ilike match |
| language | text | nullable, exact match |
| active | boolean | default true |
| created_at | timestamptz | |

### Database Triggers (7 total)

| Trigger | Table | Event | What it does |
|---|---|---|---|
| `trg_notify_new_application` | applications | INSERT | Notifies production house owner |
| `trg_notify_high_match` | applications | INSERT | Notifies if match_score ≥ 75 |
| `trg_notify_new_message` | messages | INSERT | Notifies message recipient |
| `trg_talent_alert` | talent_profiles | INSERT | Notifies users whose alert filters match the new profile |
| `trg_application_status_change` | applications | UPDATE status | Notifies talent when status changes to shortlisted/interview/hired/rejected |

---

## 5. Authentication Flow

```
Register (/register)
  → POST /auth/register { email, password, username, role }
  → Supabase creates auth.users row, sends OTP email
  → Inserts public.users row

Verify (/verify)
  → POST /auth/verify { email, otp }
  → Supabase verifies OTP, returns session tokens
  → Returns { access_token, refresh_token, user.role }

Create Profile (/create-profile)
  → POST /production/profile OR POST /talent/profile
  → Inserts profile row, stores profileId in AuthContext

Login (/login)
  → supabase.auth.signInWithPassword({ email, password })
  → Fetches role from public.users
  → Fetches profileId from production_profiles or talent_profiles
  → Stores everything in localStorage via AuthContext

Forgot Password
  → supabase.auth.resetPasswordForEmail(email)
  → Supabase sends reset link to email

Token Refresh
  → Runs automatically every 50 minutes via setInterval in AuthContext
  → supabase.auth.refreshSession()

Logout
  → supabase.auth.signOut()
  → Clears all localStorage keys
```

### JWT Middleware (server)
Every protected route runs `requireAuth`:
1. Reads `Authorization: Bearer <token>` header
2. Calls `supabase.auth.getUser(token)`
3. Attaches user to `req.user`
4. Returns 401 if missing or invalid

### Rate Limiting
- `/auth/*` — 10 requests per 15 minutes per IP
- All other routes — 300 requests per minute per IP

---

## 6. Full API Reference

### Auth
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password, username, role }` | `{ message, user }` |
| POST | `/auth/verify` | — | `{ email, otp }` | `{ access_token, refresh_token, user }` |
| POST | `/auth/forgot-password` | — | `{ email }` | `{ message }` |

### Production Profiles
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/production/profile` | ✅ | `{ user_id, company_name, bio?, production_details? }` | `{ profile }` |
| GET | `/production/profile/:id` | — | — | `{ profile }` |

### Talent Profiles
| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/talent/profile` | ✅ | `{ user_id, full_name?, role?, skills?, ... }` | `{ profile }` |
| GET | `/talent/search` | — | `?skills=&role=&location=&language=` | `{ talent[] }` |

### Jobs
| Method | Endpoint | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/jobs` | — | `?production_id=&status=` | `{ jobs[] }` |
| POST | `/jobs` | ✅ | `{ production_id, title, description }` | `{ job }` |
| GET | `/jobs/:id` | — | — | `{ job }` with production_profiles joined |
| POST | `/jobs/:id/view` | — | — | `{ ok }` |
| GET | `/jobs/:id/analytics` | ✅ | — | `{ view_count, applicant_count, avg_match_score }` |
| GET | `/jobs/:id/talent-matches` | ✅ | — | `{ talent[] }` ranked by match_score |
| PUT | `/jobs/:id/requirements` | ✅ | `{ skills[], roles[], experience_level, language, location }` | `{ requirements }` |
| POST | `/jobs/:id/publish` | ✅ | — | `{ job }` |
| POST | `/jobs/:id/close` | ✅ | — | `{ job }` |
| GET | `/jobs/:id/applications` | ✅ | — | `{ applications[] }` sorted by match_score desc |

### Applications
| Method | Endpoint | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/applications/my` | ✅ | `?talent_profile_id=` | `{ applications[] }` with job + company joined |
| POST | `/applications` | ✅ | `{ job_id, talent_profile_id, cover_note? }` | `{ application }` |
| PUT | `/applications/:id/status` | ✅ | `{ status }` | `{ application }` |
| GET | `/applications/:id/match-breakdown` | ✅ | — | Full breakdown with per-signal scores |

### Notifications
| Method | Endpoint | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/notifications` | ✅ | `?user_id=&unread_only=` | `{ notifications[], unread_count }` |
| GET | `/notifications/unread-count` | ✅ | `?user_id=` | `{ count }` |
| PUT | `/notifications/:id/read` | ✅ | — | `{ notification }` |
| PUT | `/notifications/read-all` | ✅ | `?user_id=` | `{ message }` |

### Dashboard
| Method | Endpoint | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/dashboard/stats` | ✅ | `?production_id=&user_id=` | `{ active_jobs, new_applications, recommended_talent, unread_notifications }` |

### Saved Jobs
| Method | Endpoint | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/saved-jobs` | ✅ | `?talent_profile_id=` | `{ saved[] }` |
| POST | `/saved-jobs` | ✅ | `{ job_id, talent_profile_id }` | `{ ok }` |
| DELETE | `/saved-jobs` | ✅ | `{ job_id, talent_profile_id }` | `{ ok }` |

### Talent Alerts
| Method | Endpoint | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/talent-alerts` | ✅ | `?user_id=` | `{ alerts[] }` |
| POST | `/talent-alerts` | ✅ | `{ user_id, label, skills?, role?, location?, language? }` | `{ alert }` |
| DELETE | `/talent-alerts/:id` | ✅ | — | `{ ok }` |

### Health
| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |

---

## 7. Match Scoring Engine

Every application gets a 0–100 score computed from 7 weighted signals.

### Weights
| Signal | Weight | What it measures |
|---|---|---|
| skills_match | **30%** | % of job's required skills present in talent's skill list |
| role_match | **20%** | 100 if talent's role is in job's roles list, 0 if not |
| experience_match | **15%** | How close talent's years are to the level's midpoint |
| language_match | **10%** | Exact match on language |
| location_proximity | **10%** | Same city = 100, remote = 90, same prefix = 50, no match = 0 |
| profile_completeness | **10%** | % of 8 profile fields filled (name, bio, role, skills, language, location, avatar, portfolio) |
| activity_recency | **5%** | Active ≤7d = 100, ≤30d = 60, ≤90d = 30, older = 0 |

### Experience Midpoints
| Level | Midpoint | Score formula |
|---|---|---|
| entry | 1 year | 100 × e^(–0.15 × gap²) |
| mid | 4 years | same |
| senior | 9 years | same |
| any / null | neutral | returns 75 |

### Example
A talent with 4 years experience applying to a `mid` level job → gap = 0 → score = 100%.
Same talent applying to a `senior` level job → gap = 5 → score = 100 × e^(–3.75) ≈ 24%.

---

## 8. Frontend Pages

| Route | Page | Who can access | What it does |
|---|---|---|---|
| `/login` | Login | Public | Email + password sign in, forgot password flow |
| `/register` | Register | Public | Role selector (Production / Talent) + form |
| `/verify` | Verify | Public | 6-digit OTP input with paste + auto-advance |
| `/create-profile` | CreateProfile | Auth | Production form or Talent form based on role |
| `/home` | Home | Auth | **Production**: stat cards + My Jobs list. **Talent**: My Applications + Open Jobs |
| `/jobs/:id` | JobDetail | Auth | Full job view, Apply modal, Bookmark button, view recorded |
| `/jobs/create` | CreateJob | Auth (production) | 3-step wizard: details → requirements → review+publish |
| `/applications` | Applications | Auth (production) | Pipeline summary, ranked cards, comparison modal, action buttons |
| `/search` | Search | Auth | Filter sidebar, talent grid with highlighted matching skills |
| `/chat` | Chat | Auth | Conversation list, message thread, realtime, read receipts |
| `/profile` | Profile | Auth | View + inline edit, avatar upload, Message button on others' profiles |
| `/profile/:id` | Profile (other) | Auth | Read-only view + Message button |

---

## 9. AuthContext

Stored in **localStorage** (persists across tab closes).

### Keys
```
cc_access_token    — Supabase JWT
cc_refresh_token   — Supabase refresh token
cc_user_id         — UUID from auth.users
cc_user_email      — user's email
cc_user_role       — 'production' | 'talent'
cc_profile_id      — production_profiles.id or talent_profiles.id
```

### State shape
```typescript
{
  user: { id, email, role, profileId } | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
}
```

### Methods
- `setSession(token, refreshToken, user)` — bootstraps after login/verify
- `setProfileId(id)` — stores profileId after onboarding
- `logout()` — calls `supabase.auth.signOut()`, clears all storage

---

## 10. Real-time Features

### 1. Notifications Bell
```
Channel: notifications:{userId}
Filter:  user_id=eq.{userId}
Event:   INSERT
Effect:  increments unread count, prepends to dropdown if open
```

### 2. Chat messages
```
Channel: chat:{userId}
Filter:  recipient_id=eq.{userId}
Event:   INSERT
Effect:  appends to active thread, updates conversation list, auto-marks read
```

### 3. Application status (talent)
```
Channel: my-apps:{profileId}
Filter:  talent_profile_id=eq.{profileId}
Event:   UPDATE
Effect:  updates status badge on My Applications list in real time
```

---

## 11. Design System

### Colour tokens (tailwind.config.js)
```js
brand:   { DEFAULT: '#1F6FEB', light: '#4D8FF0', dark: '#1558C0', navy: '#0B2545' }
surface: { base: '#FFFFFF', section: '#F5F7FA', border: '#E2E8F0' }
content: { primary: '#1A1A2E', heading: '#0B2545', secondary: '#475569', tertiary: '#94A3B8' }
```

### Component classes (index.css)
```
.card          — white card with shadow
.card-hover    — card + lift on hover
.input         — white input with blue focus ring
.input-error   — red border variant
.btn-primary   — blue filled button, white text
.btn-navy      — deep navy filled button
.btn-ghost     — bordered button
.btn-outline   — blue bordered, fills on hover
.nav           — sticky white nav bar
.nav-link      — nav item with hover highlight
.badge         — rounded pill badge
.label         — form field label
.skeleton      — animated loading placeholder
.error-banner  — red tinted error box
.section-title — navy heading text
```

### Fonts
- **Inter** — all body text and UI (400/500/600/700)
- **IBM Plex Mono** — scores, numbers, dates, OTP inputs

---

## 12. Security

| Layer | What's protected |
|---|---|
| Helmet | Sets 14 security HTTP headers (XSS, clickjack, MIME sniff) |
| CORS | `ALLOWED_ORIGINS` env var — only listed origins accepted |
| Rate limiting | Auth: 10 req/15min · General: 300 req/min |
| JWT validation | Every `requireAuth` route validates the Supabase JWT |
| Input sanitization | `stripHtml()` on all free-text fields before DB insert |
| Row Level Security | Every table has RLS — users can only read/write their own data |
| Service role key | Only on server, never sent to browser |
| Body size limit | `1mb` max on JSON bodies |

---

## 13. Testing (85 tests)

| File | Tests | What's covered |
|---|---|---|
| `matchScore.test.ts` | 43 | All 7 signals, edge cases, boundary values, weights sum |
| `authController.test.ts` | 11 | Registration + OTP validation |
| `jobController.test.ts` | 6 | Create + list + requirements validation |
| `applicationsController.test.ts` | 8 | Apply + status update + breakdown |
| `health.test.ts` | 2 | Health endpoint |
| `Login.test.tsx` | 8 | Form validation, toggle, nav links |
| `Register.test.tsx` | 7 | All validation paths, role selector, success navigation |

Run all tests:
```bash
npm test                    # runs server + client tests
npm run test:server         # server only (65 tests)
npm run test:client         # client only (20 tests)
```

---

## 14. Environment Variables

### server/.env
```
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### client/.env
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> `SUPABASE_SERVICE_ROLE_KEY` = admin key, server only, never expose to browser.  
> `VITE_SUPABASE_ANON_KEY` = public key, safe in browser.

---

## 15. Running Locally

```bash
# 1. Clone
git clone https://github.com/Suryani-76/Cine_connect_app.git
cd Cine_connect_app

# 2. Install dependencies
npm install

# 3. Fill in environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit both .env files with your Supabase credentials

# 4. Run SQL migrations in Supabase SQL Editor (in order)
#    001 → 002 → 003 → 004 → 005 → 006 → 007

# 5. Create Supabase Storage bucket named 'avatars' (public)

# 6. Start both servers
npm run dev          # starts server + client concurrently

# OR separately:
npm run dev:server   # http://localhost:3000
npm run dev:client   # http://localhost:5173
```

---

## 16. Useful Scripts

```bash
npm run dev              # start both servers
npm run build            # build both for production
npm test                 # run all 85 tests
npm run typecheck        # TypeScript check both workspaces
npm run validate-env     # check all env vars are set correctly
npm run health-check     # ping localhost:3000/health
npm run build-check      # full pre-deploy: typecheck + test + build
npm run docker:up        # docker compose up --build
```

---

## 17. Deployment

### Client → Vercel
- Push to `production` branch → CI builds automatically
- `client/vercel.json` handles SPA rewrites, asset caching, security headers
- Set env vars in Vercel dashboard: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Server → Fly.io
- `server/fly.toml` configured for Mumbai (`bom`) region
- `fly deploy --config server/fly.toml`
- Set secrets: `fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ALLOWED_ORIGINS=...`

### CI/CD — GitHub Actions
On every push to `main` or `production`:
1. TypeScript check (server)
2. Run 65 server tests
3. Build server
4. TypeScript check (client)
5. Run 20 client tests
6. Build client
7. Docker build check
