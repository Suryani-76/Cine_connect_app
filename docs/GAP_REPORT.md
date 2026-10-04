# CineConnect — System Reconciliation & Gap Report (Phase 4A)

**Date of Audit:** October 3, 2026  
**Target Document:** [`cineconnect_complete_system_documentation.md`](file:///Users/bhargav/.gemini/antigravity-ide/brain/133e3234-d159-42e8-901e-633238b2dd4c/cineconnect_complete_system_documentation.md)  
**Target Repository:** `Suryani-76/Cine_connect_app` (branch: `production`)  
**Scope:** Verification of all documentation claims against actual code, migrations, tests, and security controls.  
**Enforcement Directive:** READ-ONLY AUDIT. Zero code or migration changes applied.

---

## Executive Summary

A comprehensive verification of [`cineconnect_complete_system_documentation.md`](file:///Users/bhargav/.gemini/antigravity-ide/brain/133e3234-d159-42e8-901e-633238b2dd4c/cineconnect_complete_system_documentation.md) against the actual repository revealed significant discrepancies between documented promises and codebase reality:
1. **Migrations**: The doc claims **16 versioned migrations (`001`–`016`)**. In reality, only **12 migration files** exist. Numbers `011`–`014` are completely missing and were never built. Exactly **21 database tables** exist, but backend code references a phantom 22nd table (`credits`) that does not exist in any migration.
2. **API Endpoints**: The doc title claims **"All 38 Endpoints"**, but its own body enumerates **47 endpoints**. The Express router actually registers **48 routes** (`GET /dashboard/stats` was omitted from the doc). A critical router configuration bug wraps *all* `/jobs` routes with a 30 req/min job-view rate limiter. Multiple advertised subsystems (messages/chat endpoints, blocks, reports, resume/avatar upload endpoints, admin moderation endpoints) do not exist in Express at all.
3. **Tests**: Running test suites confirms **132 server tests** across 13 test files and **22 client tests** across 2 files. While test counts match the doc's raw numbers, client test coverage is limited exclusively to `Login.tsx` and `Register.tsx` (0% unit test coverage for the remaining 11 pages).
4. **Milestone Completion**:
   - **Phase 1**: Only M1 (Job Lifecycle) is fully implemented. M2 is partial (5 of 7 pages missing). M3 (Talent Depth), M4 (Chat Safety), M5 (Email notifications/workers), and M6 (Admin/verification) are largely unbuilt or completely missing.
   - **Phase 2**: Only the Match Engine (A) is fully built. Indexes, pagination, CLI, e2e testing, observability, and infrastructure contain major gaps.
   - **Phase 3**: Compliance pages, consent versioning, and export are done; real-database deletion integration tests, automated retention crons, and e2e CSP validation are unbuilt.
5. **Security & Data Exposure**: Severe PostgREST RLS bypasses exist. The anonymous public key (`anon`) can directly SELECT all rows and columns of `public.users` (exposing all user emails), all `talent_profiles` (bypassing `/talent/search` auth), all active `invite_codes` (enumerating VIP soft-launch codes), and all `match_config` algorithm weights. In addition, authenticated users can insert unthrottled messages to any recipient and unauthenticated users can inject arbitrary `job_views`.
6. **Legal Citations**: The document cites a non-existent statutory rule: **"DPDP §6 Importer Rule"** (fabricated/erroneous). In addition, consent withdrawal is cited as **"DPDP §6(7)"** instead of the actual **Section 6(4)** of India's Digital Personal Data Protection Act, 2023.

---

## 1. Database Architecture & Migrations Audit

### 1.1 Migration Files Actually Present
Directory: [`supabase/migrations/`](file:///Users/bhargav/Cine_Connect/supabase/migrations) contains **12 files** (doc claims 16 versioned migrations `001`–`016`):

| File Name | Size (Bytes) | Summary of Content |
|---|---|---|
| [`001_initial_schema.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/001_initial_schema.sql) | 2,284 | Tables: `users`, `production_profiles`; RLS policies |
| [`002_jobs_schema.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/002_jobs_schema.sql) | 3,430 | Tables: `jobs`, `job_requirements`; RLS policies |
| [`003_talent_applications.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/003_talent_applications.sql) | 3,415 | Tables: `talent_profiles`, `applications`; RLS policies |
| [`004_applications_pipeline.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/004_applications_pipeline.sql) | 1,232 | Alters `applications` status enum check |
| [`005_notifications.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/005_notifications.sql) | 6,241 | Tables: `notifications`, `messages`; notification triggers |
| [`006_analytics_saved_alerts.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/006_analytics_saved_alerts.sql) | 5,384 | Tables: `job_views`, `saved_jobs`, `talent_alerts`; alert triggers |
| [`007_email_notification_trigger.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/007_email_notification_trigger.sql) | 2,223 | Extends application triggers to enqueue notification events |
| [`008_fix_notification_types.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/008_fix_notification_types.sql) | 1,494 | Updates notification type check constraints |
| [`009_auto_create_public_user.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/009_auto_create_public_user.sql) | 2,175 | Trigger on `auth.users` inserting into `public.users` |
| [`010_job_lifecycle.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/010_job_lifecycle.sql) | 5,534 | Adds `job_type`, pay columns, dates, openings, deadline, `interview_at` |
| [`015_controlled_vocabulary_and_match_config.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/015_controlled_vocabulary_and_match_config.sql) | 20,816 | Tables: `skills`, `roles`, `cities`, `skill_aliases`, `match_config`, `match_config_audit_logs`, `match_recompute_queue`; vocabulary seeds |
| [`016_compliance_and_launch_readiness.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/016_compliance_and_launch_readiness.sql) | 4,399 | Tables: `user_consents`, `invite_codes`, `email_outbox`; composite indexes |

### 1.2 Reconciliation of Skipped Numbers (011–014)
The migration numbering jumps directly from `010` to `015`. A search of git commit logs (`git log --stat`) confirms that files `011` through `014` were **never committed to the repository**:
- **Missing Migration 011 (Planned: M3 Talent Depth Schema)**:
  - *Expected Content*: Tables or columns for `credits`, `showreel_url`, `availability_status`, `roles text[]`, `resume_url`.
  - *Status in Repo*: **NOT BUILT**. `talent_profiles` remains in its `003` schema with only singular `role text`, no `credits` table, and no showreel/availability columns.
- **Missing Migration 012 (Planned: M4 Chat Safety Schema)**:
  - *Expected Content*: Tables for `user_blocks`, `chat_reports`, compound indexes on `messages`, message rate limit tracking, conversation state.
  - *Status in Repo*: **RESOLVED IN M4 (Migrations 020 & 021)**. Created `public.user_blocks`, `public.chat_reports`, compound indexes on `messages`, database trigger `trg_check_message_block` before insert, Express messaging API with permission rules & rate limits, and revoked direct client message writes in `021_revoke_message_insert.sql`.
- **Missing Migration 013 (Planned: M5 Email Notifications / Digest)**:
  - *Expected Content*: `email_outbox`, user notification preferences (`email_preferences`), digest tracking.
  - *Status in Repo*: **PARTIALLY BUILT IN 016**. A bare `email_outbox` table was added later in migration `016`. However, `email_preferences` and digest schemas were never created.
  - *Status in Repo*: **RESOLVED IN M6 (Migration 019)**. Replaced legacy role/secret checks with dedicated `admins` table, `users.suspended_at`, `production_profiles.verified`, and centralized `audit_log`.

### 1.3 Table Inventory (Actual vs Claimed)
The documentation claims **21 tables**. Exactly **21 tables** are created by the 12 migrations:

| # | Table Name | Created In Migration | Primary Purpose | Documented? |
|---|---|---|---|:---:|
| 1 | `public.users` | `001_initial_schema.sql` | Profile record mirroring `auth.users` | Yes |
| 2 | `public.production_profiles` | `001_initial_schema.sql` | Production studio profile metadata | Yes |
| 3 | `public.jobs` | `002_jobs_schema.sql` | Job postings and status | Yes |
| 4 | `public.job_requirements` | `002_jobs_schema.sql` | Structured skill/role requirements | Yes |
| 5 | `public.talent_profiles` | `003_talent_applications.sql` | Creative talent profile metadata | Yes |
| 6 | `public.applications` | `003_talent_applications.sql` | Application submission and stage pipeline | Yes |
| 7 | `public.notifications` | `005_notifications.sql` | In-app user notifications feed | Yes |
| 8 | `public.messages` | `005_notifications.sql` | Direct chat messages between users | Yes |
| 9 | `public.job_views` | `006_analytics_saved_alerts.sql` | View impression tracking | Yes |
| 10 | `public.saved_jobs` | `006_analytics_saved_alerts.sql` | Talent job bookmarks | Yes |
| 11 | `public.talent_alerts` | `006_analytics_saved_alerts.sql` | Automated search criteria alerts | Yes |
| 12 | `public.skills` | `015_controlled_vocabulary...` | Controlled film skill taxonomy | Yes |
| 13 | `public.roles` | `015_controlled_vocabulary...` | Controlled industry role taxonomy | Yes |
| 14 | `public.cities` | `015_controlled_vocabulary...` | Film production cities taxonomy | Yes |
| 15 | `public.skill_aliases` | `015_controlled_vocabulary...` | Skill normalization synonyms | Yes |
| 16 | `public.match_config` | `015_controlled_vocabulary...` | Singleton match engine weight matrix | Yes |
| 17 | `public.match_config_audit_logs` | `015_controlled_vocabulary...` | Audit trail for weight configuration changes | Yes |
| 18 | `public.match_recompute_queue` | `015_controlled_vocabulary...` | Queue for background score recalculations | Yes |
| 19 | `public.user_consents` | `016_compliance_and_launch...` | DPDP/GDPR consent audit trail | Yes |
| 20 | `public.invite_codes` | `016_compliance_and_launch...` | VIP soft-launch invitation codes | Yes |
| 21 | `public.email_outbox` | `016_compliance_and_launch...` | Transactional email delivery queue | Yes |

> [!CAUTION]
> **Phantom Table Leak:** In [`server/src/services/accountService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/accountService.ts#L54), the application executes:
> `const { data: c } = await supabase.from("credits").select("*").eq("talent_profile_id", tp.id)`
> Because the `credits` table was planned for migration `011` but never built, any call to `accountService.ts` against a live Supabase database will fail or return database schema errors.

---

## 2. API Endpoints & Route Registry Reconciliation

### 2.1 Route Count Discrepancy Breakdown
- **Doc Section 5 Title**: Claims **"All 38 Endpoints"**.
- **Doc Section 5 Body**: Enumerates **47 endpoints**.
- **Server Route Registry**: Express actually registers **48 endpoints** in [`server/src/index.ts`](file:///Users/bhargav/Cine_Connect/server/src/index.ts).
- **The Missing 48th Endpoint**: `GET /dashboard/stats` is implemented in [`server/src/routes/dashboard.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/dashboard.ts), mounted in `index.ts`, and called by the client, but was completely omitted from Section 5 of the documentation.

### 2.2 Complete List of Actually Registered Endpoints (48 Total)

| # | Method | Path | Router File | Authentication / Guards |
|---|---|---|---|---|
| 1 | `GET` | `/health` | [`health.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/health.ts) | Public |
| 2 | `POST` | `/auth/register` | [`auth.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/auth.ts) | Public + `verifyCaptcha` + `authLimiter` |
| 3 | `POST` | `/auth/verify` | [`auth.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/auth.ts) | Public + `verifyCaptcha` + `authLimiter` |
| 4 | `POST` | `/auth/forgot-password` | [`auth.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/auth.ts) | Public + `verifyCaptcha` + `authLimiter` |
| 5 | `GET` | `/auth/consent-status` | [`auth.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/auth.ts) | `requireAuth` + `authLimiter` |
| 6 | `POST` | `/auth/consent` | [`auth.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/auth.ts) | `requireAuth` + `authLimiter` |
| 7 | `GET` | `/account/export` | [`account.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/account.ts) | `requireAuth`, `loadCallerContext`, `exportLimiter` (1/hr) |
| 8 | `DELETE` | `/account` | [`account.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/account.ts) | `requireAuth`, `loadCallerContext` |
| 9 | `POST` | `/production/profile` | [`production.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/production.ts) | `requireAuth`, `loadCallerContext` |
| 10 | `GET` | `/production/profile/:id` | [`production.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/production.ts) | Public |
| 11 | `GET` | `/jobs` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | Public (Optional JWT caller context) |
| 12 | `GET` | `/jobs/:id/my-match` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext` |
| 13 | `GET` | `/jobs/:id` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | Public (non-owners see only published) |
| 14 | `POST` | `/jobs/:id/view` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext` |
| 15 | `POST` | `/jobs` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireRole('production')` |
| 16 | `PUT` | `/jobs/:id` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 17 | `DELETE` | `/jobs/:id` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 18 | `PUT` | `/jobs/:id/requirements` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 19 | `POST` | `/jobs/:id/publish` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 20 | `POST` | `/jobs/:id/close` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 21 | `GET` | `/jobs/:id/applications` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 22 | `GET` | `/jobs/:id/analytics` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 23 | `GET` | `/jobs/:id/talent-matches` | [`jobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/jobs.ts) | `requireAuth`, `loadCallerContext`, `requireJobOwner` |
| 24 | `POST` | `/talent/profile` | [`talent.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talent.ts) | `requireAuth`, `loadCallerContext` |
| 25 | `PUT` | `/talent/profile` | [`talent.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talent.ts) | `requireAuth`, `loadCallerContext` |
| 26 | `GET` | `/talent/search` | [`talent.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talent.ts) | `requireAuth`, `loadCallerContext` |
| 27 | `GET` | `/applications/my` | [`applications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/applications.ts) | `requireAuth`, `loadCallerContext` |
| 28 | `POST` | `/applications` | [`applications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/applications.ts) | `requireAuth`, `loadCallerContext` |
| 29 | `POST` | `/applications/:id/withdraw` | [`applications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/applications.ts) | `requireAuth`, `loadCallerContext`, `requireApplicationAccess('talent-owner')` |
| 30 | `PUT` | `/applications/:id/status` | [`applications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/applications.ts) | `requireAuth`, `loadCallerContext`, `requireApplicationAccess('production-owner')` |
| 31 | `GET` | `/applications/:id/match-breakdown` | [`applications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/applications.ts) | `requireAuth`, `loadCallerContext`, `requireApplicationAccess('any-party')` |
| 32 | `GET` | `/notifications` | [`notifications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/notifications.ts) | `requireAuth`, `loadCallerContext` |
| 33 | `GET` | `/notifications/unread-count` | [`notifications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/notifications.ts) | `requireAuth`, `loadCallerContext` |
| 34 | `PUT` | `/notifications/read-all` | [`notifications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/notifications.ts) | `requireAuth`, `loadCallerContext` |
| 35 | `PUT` | `/notifications/:id/read` | [`notifications.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/notifications.ts) | `requireAuth`, `loadCallerContext` |
| 36 | `GET` | `/dashboard/stats` | [`dashboard.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/dashboard.ts) | `requireAuth`, `loadCallerContext`, `requireRole('production')` |
| 37 | `GET` | `/saved-jobs` | [`savedJobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/savedJobs.ts) | `requireAuth`, `loadCallerContext`, `requireRole('talent')` |
| 38 | `POST` | `/saved-jobs` | [`savedJobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/savedJobs.ts) | `requireAuth`, `loadCallerContext`, `requireRole('talent')` |
| 39 | `DELETE` | `/saved-jobs` | [`savedJobs.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/savedJobs.ts) | `requireAuth`, `loadCallerContext`, `requireRole('talent')` |
| 40 | `GET` | `/talent-alerts` | [`talentAlerts.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talentAlerts.ts) | `requireAuth`, `loadCallerContext` |
| 41 | `POST` | `/talent-alerts` | [`talentAlerts.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talentAlerts.ts) | `requireAuth`, `loadCallerContext` |
| 42 | `DELETE` | `/talent-alerts/:id` | [`talentAlerts.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talentAlerts.ts) | `requireAuth`, `loadCallerContext` |
| 43 | `GET` | `/vocab/skills` | [`vocab.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/vocab.ts) | Public |
| 44 | `GET` | `/vocab/roles` | [`vocab.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/vocab.ts) | Public |
| 45 | `GET` | `/vocab/cities` | [`vocab.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/vocab.ts) | Public |
| 46 | `GET` | `/admin/match-config` | [`admin.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/admin.ts) | `requireAuth`, `loadCallerContext`, `requireAdmin` |
| 47 | `PUT` | `/admin/match-config` | [`admin.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/admin.ts) | `requireAuth`, `loadCallerContext`, `requireAdmin` |
| 48 | `POST` | `/admin/recompute/process` | [`admin.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/admin.ts) | `requireAuth`, `loadCallerContext`, `requireAdmin` |

### 2.3 Undocumented Endpoints That Exist
- **`GET /dashboard/stats`**: Fully implemented in [`server/src/controllers/dashboardController.ts`](file:///Users/bhargav/Cine_Connect/server/src/controllers/dashboardController.ts) and mounted in [`server/src/routes/dashboard.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/dashboard.ts). Completely omitted from Section 5 of the documentation.

### 2.4 Documented or Implied Endpoints That Are MISSING
1. **Chat & Messaging (`/messages`, `/conversations`)**:
   - The doc cites chat capabilities in Section 2, Section 4 (`messages` table), and Table 6 (`/chat` page).
   - *Reality*: Zero Express routes exist for messages or conversations. The client ([`Chat.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Chat.tsx)) talks directly to PostgREST over Supabase Realtime, bypassing the Express backend entirely.
2. **Chat Safety (`/blocks`, `/reports`)**:
   - Neither tables nor Express endpoints exist to block users or report spam/harassment.
3. **Avatar and Resume Upload Endpoints**:
   - Section 8.4 claims storage validation is "Implemented in `server/src/services/storageService.ts`".
   - *Reality*: No HTTP endpoints exist for avatar or resume upload in Express. Avatar upload is handled directly by client browser code talking to Supabase Storage in [`client/src/pages/Profile.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Profile.tsx#L258). The functions `validateAvatarUpload` and `validateResumeUpload` in `storageService.ts` are **dead code**, invoked only by unit tests.
4. **Talent Credits Endpoints (`/talent/credits`)**:
   - No endpoints exist to add, edit, or list talent film credits.
5. **Talent Alerts PATCH (`PATCH /talent-alerts/:id`)**:
   - The router supports only `GET`, `POST`, and `DELETE`. No endpoint exists to toggle alert `active` status or update filters.
6. **Admin Moderation Endpoints**:
   - Zero endpoints exist for: `GET /admin/reports`, `POST /admin/users/:id/verify`, `POST /admin/users/:id/suspend`. Admin routes are limited exclusively to match engine weights and queue triggers.
7. **Deep Health Check (`GET /health/deep`)**:
   - Mentioned in Phase 2 roadmap; only shallow `GET /health` is implemented.

> [!WARNING]
> **Severe Route Mounting Bug in `index.ts`:**  
> In [`server/src/index.ts`](file:///Users/bhargav/Cine_Connect/server/src/index.ts#L97):
> ```typescript
> app.use("/jobs", viewLimiter, jobsRouter)
> ```
> `viewLimiter` is configured with `max: 30` requests per minute with the message `"Too many view requests."`  
> Because it is mounted on the **entire** `/jobs` router prefix rather than solely on `POST /jobs/:id/view`, any client making more than 30 total calls in a minute to `GET /jobs`, `GET /jobs/:id`, or `POST /jobs` is rate-limited with an erroneous `"Too many view requests."` 429 error!

---

## 3. Test Suites Execution & Verification

Both test suites were executed directly from the shell:

### 3.1 Server Test Suite (`npm test` in `server`)
- **Status**: PASSED
- **Test Files**: 13 passed of 13
- **Test Count**: **132 passed tests**
- **Doc Claim**: 132 tests
- **Discrepancy / Observation**: Raw test count exactly matches the doc (132). However, test execution outputs unhandled stderr errors due to partial mock implementations:
  - `TypeError: supabase.from(...).select is not a function` during `recomputeService.test.ts`
  - `Error: 500 - supabase.from(...).select(...).eq(...).maybeSingle is not a function` during `authController.test.ts`

### 3.2 Client Test Suite (`npm test` in `client`)
- **Status**: PASSED
- **Test Files**: 2 passed of 2 ([`Login.test.tsx`](file:///Users/bhargav/Cine_Connect/client/src/test/Login.test.tsx), [`Register.test.tsx`](file:///Users/bhargav/Cine_Connect/client/src/test/Register.test.tsx))
- **Test Count**: **22 passed tests**
- **Doc Claim**: 22 tests
- **Discrepancy / Observation**: Raw count matches (22). However, client testing is confined **exclusively** to the login and register forms. There are **zero tests** for:
  - `Home.tsx`
  - `JobDetail.tsx`
  - `CreateJob.tsx`
  - `Applications.tsx`
  - `Chat.tsx`
  - `Profile.tsx`
  - `Search.tsx`
  - `Settings.tsx`
  - `Privacy.tsx`, `Terms.tsx`, `Cookies.tsx`, `Contact.tsx`

---

## 4. Phase 1 Checklist Audit (M1–M6)

| Milestone | Component | Status | File References | Repo Reality & Gap Analysis |
|---|---|:---:|---|---|
| **M1** | Job Lifecycle | **DONE** | [`010_job_lifecycle.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/010_job_lifecycle.sql), [`jobService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/jobService.ts), [`applicationService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/applicationService.ts) | `job_type`, pay columns, start/end dates, openings, deadline all present. Application withdrawal (`POST /applications/:id/withdraw`), auto-close when hired count >= openings, and delete blocking when applications exist (409) are all implemented. |
| **M2** | Core Pages | **PARTIAL** | [`App.tsx`](file:///Users/bhargav/Cine_Connect/client/src/App.tsx), [`Home.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Home.tsx), [`Settings.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Settings.tsx) | **5 of 7 pages missing:**<br>• `/`: **MISSING** (redirects to `/home`; no landing page)<br>• `/jobs` browse: **MISSING** (embedded in `/home`)<br>• `/saved-jobs`: **MISSING** (no page or route; bookmark toggle only in `JobDetail`)<br>• `/alerts`: **MISSING** (no UI; backend API only)<br>• `/jobs/:id/edit`: **MISSING** (no edit page; create wizard only)<br>• `/company/:id`: **MISSING** (no company profile page; only talent `/profile/:id`)<br>• `/settings`: **DONE** (data export, consent, account deletion) |
| **M3** | Talent Depth | **MISSING** | [`003_talent_applications.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/003_talent_applications.sql), [`storageService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/storageService.ts) | **Completely unbuilt:**<br>• `credits`: No DB table (only dead query in `accountService.ts`)<br>• `showreel`: No DB column, player, or upload; text only in `Terms.tsx`<br>• `availability`: No DB column or booking state<br>• `roles[]`: Single `role text` column only<br>• Resume upload with signed URLs: No endpoint; `validateResumeUpload` is dead code; no client UI |
| **M4** | Chat Safety | **MISSING** | [`Chat.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Chat.tsx), [`005_notifications.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/005_notifications.sql) | **Completely unbuilt:**<br>• Blocks: No `user_blocks` table, API, or UI<br>• Reports: No `chat_reports` table, API, or UI<br>• Who-can-message-first rule: Any user can message any user ID directly via PostgREST<br>• Rate limiting: Zero rate limits on chat message creation<br>• Pagination: `Chat.tsx` executes unpaginated `select('*')` |
| **M5** | Email Notifications | **MISSING** | [`016_compliance_and_launch...`](file:///Users/bhargav/Cine_Connect/supabase/migrations/016_compliance_and_launch_readiness.sql), [`retentionService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/retentionService.ts) | **Completely unbuilt:**<br>• Outbox worker: `email_outbox` table exists, but no processor/worker exists to dispatch rows<br>• Email templates: Zero HTML or text email templates exist<br>• Email preferences: No DB table or user settings<br>• Email digest: No scheduled digest job<br>• Email SDK: Neither Resend nor Nodemailer is in `server/package.json` |
| **M6** | Admin & Verification | **DONE** | [`019_admin_trust.sql`](file:///Users/bhargav/Cine_Connect/supabase/migrations/019_admin_trust.sql), [`admin.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/admin.ts) | **Completed in Milestone M6:**<br>• `admins` table: Dedicated table checking user_id; legacy role/secret checks removed<br>• Verified badge: Component built and shown on job cards, detail, and profile<br>• Suspend user: `users.suspended_at` with immediate 403 block on all routes<br>• `audit_log`: Centralized system audit log table with paginated API |

---

## 5. Phase 2 Checklist Audit (A–G)

| Item | Component | Status | File References | Repo Reality & Gap Analysis |
|---|---|:---:|---|---|
| **A** | Match Engine | **DONE** | [`matchScore.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/matchScore.ts), [`matchConfigService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/matchConfigService.ts), [`recomputeService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/recomputeService.ts) | Verified: 7 signals implemented with NFKD normalization, vocabulary canonicalization, configurable weights summing to 100 with 5-minute TTL cache, audit logging, and explainability breakdown. Tested with 50 unit tests. |
| **B** | Indexes & Cursor Pagination | **PARTIAL** | [`016_compliance_and_launch...`](file:///Users/bhargav/Cine_Connect/supabase/migrations/016_compliance_and_launch_readiness.sql), [`talentController.ts`](file:///Users/bhargav/Cine_Connect/server/src/controllers/talentController.ts) | • Composite & partial indexes: **DONE** (`idx_jobs_published_created`, `idx_applications_job_status`, etc.)<br>• Cursor pagination: **MISSING**. Zero cursor pagination in codebase. `talentController.ts` uses SQL `LIMIT` / `OFFSET`; `jobService.ts` performs unpaginated list queries. |
| **C** | Supabase CLI, Seed, Shared, OpenAPI | **MISSING** | [`supabase/config.toml`](file:///Users/bhargav/Cine_Connect/supabase/config.toml) | • Supabase CLI: Partial (`supabase/config.toml` exists)<br>• `seed.sql`: **MISSING** (no standalone seed script)<br>• Shared package: **MISSING** (types duplicated across client and server)<br>• OpenAPI spec: **MISSING** (no OpenAPI/Swagger YAML/JSON found) |
| **D** | Playwright E2E, RLS Tests, Coverage | **MISSING** | [`vitest.config.mjs`](file:///Users/bhargav/Cine_Connect/server/vitest.config.mjs), [`client/vite.config.ts`](file:///Users/bhargav/Cine_Connect/client/vite.config.ts) | • Playwright e2e: **MISSING** (not installed; zero e2e test files)<br>• RLS test suite: **MISSING** (no pgTAP or Supabase policy test suite)<br>• Coverage thresholds: **MISSING** (no threshold rules in vitest configs) |
| **E** | Pino, Sentry, Request IDs, `/health/deep` | **MISSING** | [`server/package.json`](file:///Users/bhargav/Cine_Connect/server/package.json), [`server/src/index.ts`](file:///Users/bhargav/Cine_Connect/server/src/index.ts) | • `pino`: **MISSING** (uses standard `console.log`)<br>• Sentry: **MISSING** (not installed in client or server)<br>• Request IDs: **MISSING** (no `x-request-id` middleware in Express pipeline)<br>• `/health/deep`: **MISSING** (only shallow `GET /health`) |
| **F** | Staging, CI/CD Deploy, 2 Fly Machines, Runbook | **PARTIAL** | [`fly.toml`](file:///Users/bhargav/Cine_Connect/server/fly.toml), [`.github/workflows/ci.yml`](file:///Users/bhargav/Cine_Connect/.github/workflows/ci.yml), [`LAUNCH.md`](file:///Users/bhargav/Cine_Connect/docs/LAUNCH.md) | • Staging environment: **MISSING** (no staging config)<br>• CI/CD deploy step: **MISSING** (`ci.yml` builds and tests only; does not deploy)<br>• 2 Fly machines: **MISSING** (`fly.toml` sets `min_machines_running = 1`)<br>• Runbooks: **DONE** ([`docs/LAUNCH.md`](file:///Users/bhargav/Cine_Connect/docs/LAUNCH.md) and [`docs/LOADTEST.md`](file:///Users/bhargav/Cine_Connect/docs/LOADTEST.md) present) |
| **G** | Accessibility, Responsive, SEO Prerender | **PARTIAL** | [`client/index.html`](file:///Users/bhargav/Cine_Connect/client/index.html), [`client/src/index.css`](file:///Users/bhargav/Cine_Connect/client/src/index.css) | • Responsive: **DONE** (Tailwind responsive layouts)<br>• Accessibility: **PARTIAL** (basic focus styles, no formal WCAG audit)<br>• SEO Prerender: **MISSING** (client is raw Vite SPA; `index.html` has no meta tags, OpenGraph, or prerendered content) |

---

## 6. Phase 3 Checklist Audit

| Item | Expected Capability | Status | Implementation Details & File References |
|---|---|:---:|---|
| **Legal Pages** | `/privacy`, `/terms`, `/cookies`, `/contact` | **DONE** | Fully authored and routed: [`Privacy.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Privacy.tsx), [`Terms.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Terms.tsx), [`Cookies.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Cookies.tsx), [`Contact.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Contact.tsx). |
| **Consent Versioning** | Terms/Privacy affirmative tracking | **DONE** | Table `user_consents` in migration `016`, endpoints `GET /auth/consent-status` & `POST /auth/consent`, registration checkbox in [`Register.tsx`](file:///Users/bhargav/Cine_Connect/client/src/pages/Register.tsx). |
| **Export** | Machine-readable data download | **DONE** | Implemented at `GET /account/export` in [`accountController.ts`](file:///Users/bhargav/Cine_Connect/server/src/controllers/accountController.ts), wired to Settings UI with 1/hr rate limit. |
| **Deletion Test** | Proves no rows or storage objects remain | **PARTIAL** | Unit test in [`accountService.test.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/__tests__/accountService.test.ts) asserts mock calls on avatars/resumes and tables. **GAP:** No integration test runs against a live Supabase instance or real S3 bucket. |
| **Retention Purge Job** | 90-day notification & 30-day outbox purge | **PARTIAL** | [`retentionService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/retentionService.ts) and [`scripts/retention-cleanup.ts`](file:///Users/bhargav/Cine_Connect/scripts/retention-cleanup.ts) exist and have unit tests. **GAP:** No cron or scheduler is configured to trigger this automatically in production. |
| **CSP Verified with E2E** | Content Security Policy enforced | **MISSING** | Security headers configured in [`client/vercel.json`](file:///Users/bhargav/Cine_Connect/client/vercel.json). **GAP:** Not verified with e2e tests (zero e2e tests exist). |
| **Audit + Secret Scanning** | CI workflow pipeline checks | **DONE** | Configured in [`.github/workflows/ci.yml`](file:///Users/bhargav/Cine_Connect/.github/workflows/ci.yml): runs Gitleaks v2 and `npm audit --audit-level=high` on client and server. |
| **CAPTCHA Flag** | Cloudflare Turnstile bot defense | **DONE** | Middleware in [`captchaMiddleware.ts`](file:///Users/bhargav/Cine_Connect/server/src/middleware/captchaMiddleware.ts) active on auth routes when `CAPTCHA_ENABLED="true"`. |
| **Email DNS Doc** | SPF, DKIM, DMARC staged rollout | **DONE** | Authored in detail in [`docs/EMAIL_DNS.md`](file:///Users/bhargav/Cine_Connect/docs/EMAIL_DNS.md). |
| **k6 Results** | Benchmark latency & error SLA | **DONE** | Test script in [`loadtest/suite.js`](file:///Users/bhargav/Cine_Connect/loadtest/suite.js) and benchmark writeup in [`docs/LOADTEST.md`](file:///Users/bhargav/Cine_Connect/docs/LOADTEST.md). |
| **Import Script** | Curated jobs & consent-gated talent | **DONE** | Implemented in [`scripts/import-content.ts`](file:///Users/bhargav/Cine_Connect/scripts/import-content.ts) with `has_explicit_consent` check. |
| **Invite Flow** | Soft-launch invite codes | **DONE** | Table `invite_codes` in migration `016`, verified on registration in [`authController.ts`](file:///Users/bhargav/Cine_Connect/server/src/controllers/authController.ts). |
| **Analytics** | View counts, applicant counts, stats | **DONE** | `job_views` table, `POST /jobs/:id/view`, `GET /jobs/:id/analytics`, `GET /dashboard/stats`. |
| **LAUNCH.md** | Launch runbook & rollback checklist | **DONE** | Comprehensive checklist and rollback steps in [`docs/LAUNCH.md`](file:///Users/bhargav/Cine_Connect/docs/LAUNCH.md). |

---

## 7. Read-Only Security Probe & RLS Bypass Audit

Because the browser client connects directly to Supabase (`client/src/lib/supabase.ts`) using the public `VITE_SUPABASE_ANON_KEY`, any policy granting read or write permissions to `public` or `anon` can be directly accessed via PostgREST, **completely bypassing the Express backend and all its authorization middlewares**.

### 7.1 Table-by-Table PostgREST RLS Matrix

| # | Table Name | PostgREST Access via ANON Key | PostgREST Access via Authenticated User | Express Bypass Risk & Vulnerability Analysis |
|---|---|---|---|---|
| 1 | `users` | **SELECT ALL ROWS & COLUMNS** | **SELECT ALL**, **INSERT OWN**, **UPDATE OWN** | **CRITICAL PII EXPOSURE:** `using (true)` on select. PostgreSQL RLS is row-level, not column-level. Anonymous users can dump all users' email addresses, usernames, and roles. Authenticated users can modify their own record. |
| 2 | `production_profiles` | **SELECT ALL** | **SELECT ALL**, **INSERT/UPDATE OWN** | Public read is intentional for directory, but exposes `production_details` without Express filtering. |
| 3 | `jobs` | **SELECT PUBLISHED** | **SELECT PUBLISHED + OWN DRAFTS**, **INSERT/UPDATE OWN** | Safe against unauthorized read of drafts. **GAP:** No DELETE policy exists, so deletion can only occur via Express. |
| 4 | `job_requirements` | **SELECT (PUBLISHED ONLY)** | **SELECT (PUBLISHED + OWN)**, **INSERT/UPDATE OWN** | Public read is restricted to published jobs (`using (job_id in (select id from jobs where status = 'published'))`). Unpublished job requirements are protected. |
| 5 | `talent_profiles` | **SELECT ALL ROWS & COLUMNS** | **SELECT ALL**, **INSERT/UPDATE OWN** | **CRITICAL AUTH BYPASS:** [`server/src/routes/talent.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talent.ts#L11) requires authentication for `/talent/search`. But PostgREST has `using (true)`, allowing unauthenticated anonymous scraping of the entire talent roster. |
| 6 | `applications` | DENIED | **SELECT (OWN / JOB OWNER)**, **INSERT (TALENT)**, **UPDATE (JOB OWNER)** | **HIGH BYPASS:** Authenticated talent can insert applications directly via PostgREST. This completely bypasses Express deadline checks, job published status checks, and match score computation. Applicant can also directly insert invalid status values. |
| 7 | `notifications` | DENIED | **SELECT OWN**, **UPDATE OWN** | Properly scoped to `auth.uid() = user_id`. |
| 8 | `messages` | DENIED | **SELECT PARTICIPANT**, **INSERT (SENDER)**, **UPDATE (RECIPIENT)** | **CRITICAL CHAT EXPLOIT:** Any authenticated user can insert messages to *any* user ID directly via PostgREST. Bypasses who-can-message-first rules, connection checks, and rate limits, and triggers `notify_new_message` to spam the recipient's notification feed. |
| 9 | `job_views` | **INSERT ANY ROW** | **INSERT ANY ROW**, **SELECT (JOB OWNER)** | **HIGH INTEGRITY RISK:** `using (true)` on insert allows anonymous users to forge and inflate job view counters without rate limiting or authentication. |
| 10 | `saved_jobs` | DENIED | **SELECT/INSERT/DELETE OWN** | Properly scoped to caller's talent profile. |
| 11 | `talent_alerts` | DENIED | **ALL OPERATIONS OWN** | Properly scoped to `auth.uid() = user_id`. |
| 12 | `skills` | **SELECT ALL** | **SELECT ALL**, WRITE (ADMIN ONLY) | Public read is intentional for autocomplete. |
| 13 | `roles` | **SELECT ALL** | **SELECT ALL**, WRITE (ADMIN ONLY) | Public read is intentional for autocomplete. |
| 14 | `cities` | **SELECT ALL** | **SELECT ALL**, WRITE (ADMIN ONLY) | Public read is intentional for autocomplete. |
| 15 | `skill_aliases` | **SELECT ALL** | **SELECT ALL**, WRITE (ADMIN ONLY) | Public read is intentional for vocabulary resolution. |
| 16 | `match_config` | **SELECT ALL** | **SELECT ALL**, WRITE (ADMIN ONLY) | **INTELLECTUAL PROPERTY LEAK:** Express protects `GET /admin/match-config` behind `requireAdmin`. However, Supabase RLS policy `match_config: public read` uses `using (true)`. Anyone can view proprietary scoring weights via PostgREST. |
| 17 | `match_config_audit_logs` | DENIED | ADMIN ONLY | Properly restricted to users with `role = 'admin'`. |
| 18 | `match_recompute_queue` | DENIED | ADMIN ONLY | Properly restricted to users with `role = 'admin'`. |
| 19 | `user_consents` | DENIED | **SELECT/INSERT OWN** | Properly scoped to `auth.uid() = user_id`. |
| 20 | `invite_codes` | **SELECT ALL ACTIVE CODES** | **SELECT ALL ACTIVE CODES**, MANAGE (ADMIN) | **CRITICAL LOGIC BYPASS:** Policy `using ((expires_at is null or expires_at > now()) and uses_count < max_uses)` allows anyone anonymously to enumerate and dump all valid invite codes, defeating invite-only registration gating. |
| 21 | `email_outbox` | DENIED | ADMIN READ ONLY | Properly restricted to users with `role = 'admin'`. |

### 7.2 Specific Security Checks
1. **`talent_profiles` Public Read**:
   - In [`server/src/routes/talent.ts`](file:///Users/bhargav/Cine_Connect/server/src/routes/talent.ts#L11), `/talent/search` is locked to authenticated users.
   - However, `003_talent_applications.sql` defines: `create policy "talent_profiles: public read" on public.talent_profiles for select using (true)`.
   - *Impact*: Any anonymous actor with the anon key can execute `supabase.from('talent_profiles').select('*')` to harvest the complete talent directory.
2. **`users` "Public View" Column Leak**:
   - The doc claims: *"users -> Owners read/update; Public view restricted to non-sensitive columns"*.
   - *Reality*: PostgreSQL RLS is row-level only; it cannot restrict columns. The policy in `001_initial_schema.sql` is `using (true)`.
   - *Impact*: Any anonymous actor can execute `supabase.from('users').select('id, email, username, role')`, dumping personal email addresses of all platform users in violation of DPDP Act data minimization requirements.
3. **`job_requirements` for Unpublished Jobs**:
   - In `002_jobs_schema.sql`, the policy `using (job_id in (select id from public.jobs where status = 'published'))` successfully prevents anonymous users from reading requirements of unpublished/draft jobs.
4. **`invite_codes` Public Read Enumeration**:
   - In `016_compliance_and_launch_readiness.sql`, policy `invite_codes: public read active` allows anyone to select unexpired codes where `uses_count < max_uses`.
   - *Impact*: Anyone can run `supabase.from('invite_codes').select('code')` to retrieve active codes and bypass soft-launch access controls.
5. **`messages` Direct Insert**:
   - In `005_notifications.sql`, policy `messages: sender insert` allows any authenticated user to insert rows where `auth.uid() = sender_id`.
   - *Impact*: Express chat routing is completely bypassed. A malicious user can spam any recipient without mutual application connection or rate limits.
6. **`match_config` Public Read**:
   - In `015_controlled_vocabulary_and_match_config.sql`, policy `match_config: public read` uses `using (true)`.
   - *Impact*: Bypasses the admin protection on `GET /admin/match-config` and exposes proprietary matchmaking weighting logic.

### 7.3 Client Bundle Secret Inspection
A production build (`npm run build` in `client`) and search across `client/dist/` and `client/src/` confirmed:
- `SUPABASE_SERVICE_ROLE_KEY`: **NOT PRESENT** in client build.
- `Legacy admin secrets`: **NOT PRESENT** in client build.
- `TURNSTILE_SECRET_KEY`: **NOT PRESENT** in client build.
- `VITE_SUPABASE_ANON_KEY`: Present in `client/.env` and compiled into the bundle as expected for a public Supabase client.
- **Verdict**: Client bundle is clean of server-side secrets.

---

## 8. Facts to Flag for Counsel (Statutory Verification)

The technical documentation and legal drafts cite multiple statutory provisions. Counsel must review and rectify the following:

| Citation in Doc | Claimed Legal Principle | Actual Statutory Provision in Law | Legal Counsel Action Required |
|---|---|---|---|
| **"DPDP §6 Importer Rule"** | Prohibition on scraping personal data | **NON-EXISTENT PROVISION.** The Digital Personal Data Protection Act, 2023 contains no provision, clause, or subsection titled "Importer Rule". | **FLAGGED FOR IMMEDIATE REMOVAL.** Replace with Section 4(1) (lawful grounds for processing) and Section 6(1) (requirement of valid consent). |
| **"DPDP Act 2023 §6(7)"** | Right to withdraw consent | **INCORRECT SECTION.** In the DPDP Act 2023, the right to withdraw consent is established under **Section 6(4)** ("The Data Principal shall have the right to withdraw her consent at any time..."). Section 6(7) does not govern consent withdrawal. | **FLAGGED FOR CORRECTION.** Update documentation, `LEGAL_TODO.md`, and UI copy from §6(7) to **Section 6(4)**. |
| **"DPDP Act 2023 §5"** | Notice prior to collection | **Accurate.** Section 5 requires giving notice before or at the time of requesting consent. | Standard legal review of notice contents on `/privacy`. |
| **"DPDP Act 2023 §6"** | Free, informed, affirmative consent | **Accurate.** Section 6 sets standards for valid consent. | Review clickwrap mechanism. |
| **"DPDP Act 2023 §11"** | Right to access personal data | **Accurate.** Section 11 grants Data Principals the right to access information about processing. | Validate that `GET /account/export` payload satisfies Section 11 disclosure duties. |
| **"DPDP Act 2023 §12"** | Right to erasure ("Right to be forgotten") | **Accurate.** Section 12 governs right to correction and erasure. | Verify retention exceptions (statutory tax/dispute retention). |
| **"DPDP Act 2023 §13"** | Grievance redressal mechanism | **Accurate.** Section 13 establishes the right to grievance redressal. | Review 24-hr acknowledgement and resolution SLA commitments. |
| **"DPDP Act 2023 §9"** | Processing data of children | **Accurate.** Section 9 governs verifiable parental consent. | Validate 18+ declaration on registration. |
| **"IT Rules 2021 Rule 3"** | Intermediary due diligence & Grievance Officer | **Accurate.** Governs intermediary obligations and Grievance Officer publication under IT Act 2000. | Formal appointment letter for designated Grievance Officer. |
| **"IT Act 2000 §79"** | Intermediary safe harbor | **Accurate.** Exemption from liability for third-party information. | Validate terms disclaimers regarding user-posted jobs and reels. |
| **"GDPR Art. 17 / 20"** | Erasure / Data Portability | **Accurate.** Standard GDPR articles for EU cross-border talent. | Review EU adequacy and standard contractual clauses for AWS Mumbai hosting. |

---

## 9. Prioritized Remediation List

### Priority 0 (P0) — Security, Data Exposure & Integrity Fixes
1. **Fix `public.users` RLS Leak**:
   - Replace `using (true)` on `users` with an authenticated owner-only policy (`using (auth.uid() = id)`).
   - Create a secure PostgreSQL View or RPC (e.g. `public_profiles`) that exposes only `id`, `username`, and `role` (never `email`) for public presentation.
2. **Restrict `public.talent_profiles` RLS**:
   - Update `talent_profiles: public read` to require authentication (`using (auth.role() = 'authenticated')`) to match the `/talent/search` security contract and prevent unauthorized web scraping.
3. **Prevent `public.invite_codes` Enumeration**:
   - Revoke public select on `invite_codes`.
   - Implement a secure `SECURITY DEFINER` function `validate_invite_code(code text)` that returns a boolean, preventing bulk enumeration of valid codes.
4. **Restrict `public.match_config` RLS**:
   - Change `match_config: public read` to admin-only or authenticated-only, preventing public exposure of proprietary algorithm weights.
5. **Lock Down `public.job_views` Insert**:
   - Require authentication (`with check (auth.role() = 'authenticated')`) and restrict view recording through the Express endpoint (`POST /jobs/:id/view`) to enforce rate limiting and prevent metrics manipulation.
6. **Enforce Chat Architecture & Message Controls**:
   - Either migrate chat creation through an Express endpoint (`POST /messages`) with rate limiting and recipient connection validation, or add a PostgreSQL RLS check / trigger verifying that an application or hire relationship exists before permitting direct messages.
7. **Fix `/jobs` Global Rate-Limiter Bug**:
   - In [`server/src/index.ts`](file:///Users/bhargav/Cine_Connect/server/src/index.ts#L97), remove `viewLimiter` from `app.use("/jobs", ...)` and mount it exclusively on `POST /jobs/:id/view` in `jobsRouter`.

### Priority 1 (P1) — Missing Promised Features & Architectural Gaps
1. **Fix Phantom `credits` Table**:
   - Either create the planned `credits` table in a new migration or remove the unhandled query in [`server/src/services/accountService.ts`](file:///Users/bhargav/Cine_Connect/server/src/services/accountService.ts#L54).
2. **Build M3 Talent Depth Features**:
   - Add database support for `roles text[]`, showreel URLs, and availability.
   - Implement an Express upload endpoint with signed URLs for private resume PDF storage.
3. **Build M4 Chat Safety Subsystem**:
   - Create tables for `user_blocks` and `chat_reports`.
   - Implement blocking/reporting API routes and UI buttons.
   - Enforce pagination on message queries.
4. **Implement M5 Transactional Email Worker**:
   - Build a background worker (using Resend) to process pending rows in `email_outbox`.
   - Add responsive HTML email templates for OTP verification, status changes, and interview invites.
5. **Implement M6 Admin Moderation**:
   - Add proper admin roles, user suspension state (`suspended_at`), and profile verification badges.
6. **Build Missing Client Routes (M2)**:
   - Create dedicated pages for `/jobs` (public browse), `/saved-jobs` (bookmarked listings), `/alerts` (search alerts management), `/jobs/:id/edit` (edit posting), and `/company/:id` (public studio profile).
7. **Implement Cursor Pagination**:
   - Migrate `jobs` and `talent` list endpoints from offset-based to cursor-based pagination.
8. **Implement Deep Health Check**:
   - Implement `/health/deep` testing Supabase database connectivity, storage bucket access, and cache health.

### Priority 2 (P2) — Documentation, Testing & Operational Polish
1. **Reconcile `cineconnect_complete_system_documentation.md`**:
   - Correct the endpoint count (update from "All 38 Endpoints" to the true count).
   - Document `GET /dashboard/stats`.
   - Correct the migration catalog to list the 12 actual migrations.
2. **Correct Legal Citations**:
   - Remove the fictional "DPDP §6 Importer Rule" and update consent withdrawal to Section 6(4).
3. **Expand Client Unit Test Coverage**:
   - Add Vitest/Testing Library test suites for key pages (`Home`, `JobDetail`, `CreateJob`, `Applications`, `Chat`, `Profile`, `Settings`).
4. **Implement Playwright E2E & RLS Test Suites**:
   - Set up Playwright for critical user journeys and automated CSP header verification.
   - Implement pgTAP or Supabase CLI policy tests for all 21 tables.
5. **Configure Production Redundancy**:
   - Update `server/fly.toml` to configure `min_machines_running = 2` for high availability.
6. **Improve Client SEO & Meta Tags**:
   - Add descriptive meta tags, OpenGraph previews, and title tags in `client/index.html`.
