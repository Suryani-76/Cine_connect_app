# CineConnect — End-to-End System Architecture & Technical Documentation

> **Platform:** Two-Sided Film Industry Marketplace (Production Houses $\longleftrightarrow$ Creative Talent)  
> **Repository:** `Suryani-76/Cine_connect_app` | **Branch:** `production`  
> **Backend Architecture:** Node.js 22 + Express 4 (86 REST endpoints)  
> **Frontend Architecture:** React 18 + Vite + Tailwind CSS v3 (Single Page Application)  
> **Database & Storage:** Supabase PostgreSQL 15 (20 migrations, 27 tables, 1 secure view)  
> **Automated Test Suite:** 396 passing tests (348 backend tests across 24 test files + 48 frontend tests across 9 test files)  
> **Transactional Email Provider:** Resend (Single transactional email provider; AWS SES is not used)  
> **Legal Disclaimer:** All statutory section citations (DPDP Act §§5, 6, 6(4), 9, 11, 12, 13) are maintained strictly as technical design references and are marked **pending counsel verification** per [docs/LEGAL_TODO.md](docs/LEGAL_TODO.md) until signed off by qualified legal counsel.

---

## Table of Contents
1. [Executive Summary & Platform Scope](#1-executive-summary--platform-scope)
2. [Technology Stack & System Topology](#2-technology-stack--system-topology)
3. [Core Differentiator: The 7-Signal Match Engine](#3-core-differentiator-the-7-signal-match-engine)
4. [Database Architecture, Migrations & RLS Access Control](#4-database-architecture-migrations--rls-access-control)
5. [Complete API Reference (All 86 Endpoints)](#5-complete-api-reference-all-86-endpoints)
6. [Frontend Client Architecture & Complete Page Catalog](#6-frontend-client-architecture--complete-page-catalog)
7. [Compliance, Age Gate & Data Rights (Design References)](#7-compliance-age-gate--data-rights-design-references)
8. [Security Hardening & Zero-Trust Safeguards](#8-security-hardening--zero-trust-safeguards)
9. [Verification, Test Suites & Operational Runbooks](#9-verification-test-suites--operational-runbooks)

---

## 1. Executive Summary & Platform Scope

CineConnect is a dedicated two-sided entertainment marketplace connecting verified **Production Houses** (film studios, independent producers, casting agencies, directors) with vetted **Creative Talent** (cinematographers, editors, sound engineers, actors, lighting technicians, and production crew).

```mermaid
graph TD
    subgraph Production Houses
        P1[Post Role / Job Wizard] --> P2[Set Requirements & Pay]
        P2 --> P3[Review Ranked Applicants]
        P3 --> P4[Pipeline: Shortlist / Interview / Hire]
    end

    subgraph Match Engine & Platform Services
        M1[7-Signal Weighted Scoring Engine]
        M2[Controlled Film Vocabulary & Normalization]
        M3[Async Queue & Worker Runner]
        M4[Resend Transactional Email Engine]
    end

    subgraph Creative Talent
        T1[Verified Profile, Credits & Media] --> T2[Browse / Search Filtered Roles]
        T2 --> T3[Transparent Match Preview]
        T3 --> T4[One-Click Application]
    end

    Production Houses <--> Match Engine & Platform Services
    Creative Talent <--> Match Engine & Platform Services
```

### The Problem in Traditional Film Hiring
- **Fragmented Informal Networks:** Hiring occurs through informal messaging groups and word-of-mouth channels, resulting in nepotism, casting delays, and lack of meritocratic discoverability.
- **Role & Skill Ambiguity:** Non-standard terminology (e.g., "DoP", "Director of Photography", "Cinematographer", "Lighting Cameraman") causes high friction in search and indexing.
- **Black-Box Selection:** Applicants receive no feedback or explanation regarding why they were or were not shortlisted.
- **Unregulated Privacy Risks:** Direct transmission of resumes, phone numbers, and identity documents without compliance or privacy controls.

### The CineConnect Solution
- **Algorithmic Compatibility:** A 7-signal composite 0–100 match scoring engine assessing skills, primary role, experience tiers, languages, location proximity, profile completeness, and recency.
- **Bidirectional Explainability:** Explicit match reasoning provided to talent before applying (pre-apply score preview) and to production houses during candidate review (side-by-side candidate comparison).
- **Controlled Film Taxonomy:** Standardized mapping of ~150 specialized film skills, ~60 industry roles, and regional production hubs with Unicode NFKD alias resolution.
- **Strict Server-Enforced Privacy & Zero-Trust RLS:** Row-level security revoking all client write privileges across all 27 tables; direct database mutations occur solely through the backend Express service role.
- **Adult-Only Scope (v1):** Strict 18+ age verification gate at registration. Minor/child performer onboarding is explicitly **out of scope for v1** and deferred until formal parental consent workflows are drafted with legal counsel.

---

## 2. Technology Stack & System Topology

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                   Client: React 18 SPA                 │
│        Hosted on Vercel CDN (Edge Distribution)        │
│  Tailwind CSS v3 • React Router v6 • Vite • Lucide     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌────────────────────────────────────────────────────────┐
│            Fly.io Edge Proxy (Mumbai Region: bom)      │
│     min_machines_running = 2 (Production Redundancy)   │
│  Graceful SIGTERM Drain (20s) • Concurrency Limits     │
└───────────────────────────┬────────────────────────────┘
                            │ Reverse Proxy (trust proxy = 1)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Backend API: Node.js 22 + Express 4        │
│  86 REST Endpoints • Zod Strict • Helmet Security      │
│  Pino Request Logging • Rate Limiting • Magic Bytes    │
└─────────────┬───────────────────────────┬──────────────┘
              │ Supabase Service Role     │ HTTPS API
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   Supabase Infrastructure │ │      Resend Provider     │
│   PostgreSQL 15 (Mumbai)  │ │ Sole Transactional Email │
│ 27 Tables • RLS Lockdown  │ │ OTP Codes & Notifications│
│ Storage: 'avatars','resumes'│ └──────────────────────────┘
└───────────────────────────┘
```

### Component Inventory & Responsibilities

| Layer | Technology | Key Implementations & Boundaries |
| :--- | :--- | :--- |
| **Frontend Web App** | React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6, Lucide React, Sonner | Modern responsive client with custom design system (`#0B2545` Navy, `#E0A96D` Gold); lazy-loaded page routes; `usePageTitle`; strict client validation; zero direct PostgREST mutations. |
| **Backend REST API** | Node.js 22, Express 4, TypeScript Strict, Zod, Helmet, `express-rate-limit`, CORS | 86 strongly-typed endpoints; caller context identity resolution (`req.caller`); magic byte upload sniffing; rate-limited auth and public endpoints. |
| **Worker Subsystem** | Node.js background processors | `emailWorker` (claims outbox rows with `FOR UPDATE SKIP LOCKED` and exponential backoff), `recomputeWorker` (processes pending match queue), `retentionWorker` (anonymizes metadata and purges expired records). |
| **Database** | PostgreSQL 15 on Supabase (`ap-south-1` Mumbai) | 20 sequential migrations (`001`–`010`, `015`–`024`); 27 relational tables + 1 public profile view; database triggers for automated outbox generation, block checks, and audit logging. |
| **File Storage** | Supabase Storage (`avatars`, `resumes`) | S3-compatible object storage; server-mediated upload pipeline with 2 MB avatar cap (JPEG, PNG, WebP only; SVG forbidden to eliminate stored XSS) and 5 MB PDF resume cap. |
| **Email Delivery** | Resend API SDK | Sole transactional email provider (`RESEND_API_KEY`); HTML and plain text branded templates with unsubscribe tokens. AWS SES is completely removed. |

---

## 3. Core Differentiator: The 7-Signal Match Engine

The CineConnect Match Engine computes an explainable compatibility score ($0 \le \text{Score} \le 100$) between candidate qualifications and published job requirements.

$$\text{Composite Match Score} = \sum_{i=1}^{7} \left( \text{Signal Score}_i \times \frac{\text{Configured Weight}_i}{100} \right)$$

### Signal Breakdown & Default Scoring Logic

```
┌────────────────────────────────────────────────────────┐
│ 1. Skills Match            (Weight: 30%)  ▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 2. Role Match              (Weight: 20%)  ▓▓▓▓▓▓▓▓     │
│ 3. Experience Match        (Weight: 15%)  ▓▓▓▓▓▓       │
│ 4. Language Match          (Weight: 10%)  ▓▓▓▓         │
│ 5. Location Match          (Weight: 10%)  ▓▓▓▓         │
│ 6. Profile Completeness    (Weight: 10%)  ▓▓▓▓         │
│ 7. Activity Recency        (Weight:  5%)  ▓▓           │
└────────────────────────────────────────────────────────┘
```

| Signal | Default Weight | Algorithm Implementation Details |
| :--- | :---: | :--- |
| **1. Skills Match** | **30%** | Compares candidate skills against required skills. Normalizes strings with Unicode NFKD and resolves industry synonyms (e.g. `"DoP"` $\rightarrow$ `"Cinematographer"`, `"DaVinci"` $\rightarrow$ `"DaVinci Resolve"`, `"Sound Recordist"` $\rightarrow$ `"Sound Engineer"`). Calculated as $\frac{\text{matching canonical skills}}{\text{total required skills}} \times 100$. |
| **2. Role Match** | **20%** | Compares the candidate's primary and secondary roles against the job's targeted roles. Exact canonical match yields 100%; related discipline match yields 50%; unmatched yields 0%. |
| **3. Experience Match** | **15%** | Compares verified candidate years of experience against job requirement tiers (`entry`: 0–2 years, `mid`: 3–5 years, `senior`: 6+ years). Candidates meeting or exceeding the bracket receive 100%; proportional penalty applies if underqualified. |
| **4. Language Match** | **10%** | Evaluates overlap between production working languages and candidate fluency. Calculated as $\frac{\text{matching languages}}{\text{required languages}} \times 100$. |
| **5. Location Match** | **10%** | City match against film production hubs (Mumbai, Hyderabad, Chennai, Bengaluru, Kolkata, Kochi, Delhi NCR, Goa, Pune, Jaipur) or Remote status. Remote jobs grant 100% to all candidates. |
| **6. Profile Completeness** | **10%** | Additive score assessing candidate verification: avatar (+20), detailed bio (+20), showreel/portfolio link (+20), work credit history (+20), and contact details (+20). |
| **7. Activity Recency** | **5%** | Recency decay curve: 100% if active within 7 days, 75% within 30 days, 50% within 90 days, and 25% thereafter. |

### Configuration Caching & Audit Logging
- Scoring weights are stored in the singleton database table `public.match_config`.
- Loaded with an in-memory **5-minute TTL cache** on the backend server ([server/src/services/matchConfigService.ts](server/src/services/matchConfigService.ts)).
- Updates require administrator authorization (`requireAdmin`), require weights to sum to exactly **100**, and record snapshots in `public.match_config_audit_logs`.

### Asynchronous Queue & Final Status Immutability
- Edits to job requirements or talent profiles enqueue a recomputation task in `public.match_recompute_queue`.
- The background `recomputeWorker` processes queued items in batches.
- **Strict Immutability Rule:** Applications in terminal stages (`'hired'`, `'rejected'`, `'withdrawn'`) are **never recomputed or altered**.

---

## 4. Database Architecture, Migrations & RLS Access Control

### 4.1 Migration Catalog (All 20 Migration Files)

Directory: `supabase/migrations/` contains **20 sequential migration files**.

> **Note on Migration Numbering (011–014):** In the repository git history, migration files numbered `011` through `014` were **never created** (the counter skipped directly from `010` to `015`). The functional requirements originally intended for those numbers were subsequently implemented in migrations `017` through `024`.

| Migration File | Primary Tables Created / Modified | Purpose & Architectural Scope |
| :--- | :--- | :--- |
| `001_initial_schema.sql` | `users`, `production_profiles` | Base auth profile table, production house profiles, initial schemas. |
| `002_jobs_schema.sql` | `jobs`, `job_requirements` | Job listings, statuses (`draft`, `published`, `closed`), skill requirements. |
| `003_talent_applications.sql` | `talent_profiles`, `applications` | Creative talent profiles, applications table, match score columns. |
| `004_applications_pipeline.sql` | `applications` | Status enum check constraint (`applied`, `shortlisted`, `interview`, `hired`, `rejected`, `withdrawn`). |
| `005_notifications.sql` | `notifications`, `messages` | In-app notification feed and direct chat messaging schema. |
| `006_analytics_saved_alerts.sql`| `job_views`, `saved_jobs`, `talent_alerts` | View impression tracking, talent job bookmarks, automated candidate alerts. |
| `007_email_notification_trigger.sql` | Database Trigger | Enqueues notification events on application submissions. |
| `008_fix_notification_types.sql` | `notifications` | Extends notification type check constraints for interview scheduling. |
| `009_auto_create_public_user.sql` | Auth Trigger | Automatically synchronizes `auth.users` into `public.users` on signup. |
| `010_job_lifecycle.sql` | `jobs` (altered) | Adds `job_type`, compensation columns, openings, deadline, interview dates. |
| **011–014** | *(None)* | **Never created in repository** (migration numbering skipped from `010` to `015`). |
| `015_controlled_vocabulary_and_match_config.sql` | `skills`, `roles`, `cities`, `skill_aliases`, `match_config`, `match_config_audit_logs`, `match_recompute_queue` | Seeds ~150 film skills, ~60 roles, Indian production hubs, algorithm weights. |
| `016_compliance_and_launch_readiness.sql` | `user_consents`, `invite_codes`, `email_outbox` | Consent audit log, VIP soft-launch codes, outbox queue, performance indexes. |
| `017_hotfix_users_role.sql` | `users` (hotfix) | Strips client role modification vulnerabilities; secures auth synchronization. |
| `018_rls_lockdown.sql` | All tables; `public.public_profiles` view | Comprehensive privilege revocation; establishes service-role-as-sole-writer. |
| `019_admin_trust.sql` | `admins`, `audit_log`, `users`, `production_profiles` | Dedicated `admins` trust table; `suspended_at`; studio verification flags. |
| `020_chat_safety.sql` | `user_blocks`, `chat_reports`, `messages` | User blocking, abuse reporting, `trg_check_message_block` before insert. |
| `021_revoke_message_insert.sql` | `messages` | Permanently revokes client INSERT on `messages`, moving chat entirely behind API. |
| `022_talent_depth.sql` | `talent_credits`, `talent_profiles` (altered) | Verified credit history table, `roles text[]`, showreel, availability status. |
| `023_email_prefs.sql` | `notification_preferences`, `email_outbox` | Granular per-category email preferences, unsubscribe tokens, delivery retries. |
| `024_age_gate_consent.sql` | `user_consents` (altered) | Adds `age_confirmed boolean` column enforcing statutory 18+ age gate. |

---

### 4.2 Complete Table Inventory (27 Relational Tables + 1 View)

The repository defines exactly **27 relational database tables** and **1 secure projection view**:

```
 1. admins                       10. jobs                         19. saved_jobs
 2. applications                 11. match_config                 20. skill_aliases
 3. audit_log                    12. match_config_audit_logs      21. skills
 4. chat_reports                 13. match_recompute_queue        22. talent_alerts
 5. cities                       14. messages                     23. talent_credits
 6. email_outbox                 15. notification_preferences     24. talent_profiles
 7. invite_codes                 16. notifications                25. user_blocks
 8. job_requirements             17. production_profiles          26. user_consents
 9. job_views                    18. roles                        27. users
 + public.public_profiles (Secure Projection View)
```

---

### 4.3 Row-Level Security (RLS) & Access Control Matrix

In accordance with [docs/RLS_MATRIX.md](docs/RLS_MATRIX.md) and Migration `018_rls_lockdown.sql`:
1. **Server-As-Sole-Writer:** All `INSERT`, `UPDATE`, and `DELETE` privileges are revoked from `anon` and `authenticated` roles at the SQL level. The backend Express API using the Supabase `service_role` key is the sole authorized writer.
2. **Minimal Client SELECT:** Direct client SELECT queries via `supabase.from(...)` are restricted solely to Supabase Realtime feeds (`notifications`, `messages` for thread participants) and public controlled vocabularies (`skills`, `roles`, `cities`, `skill_aliases`).
3. **No Direct Sensitive Data Exposure:** Private identity tables (`users`, `production_profiles`, `talent_profiles`, `invite_codes`, `user_consents`, `job_views`, `admins`, `audit_log`, `chat_reports`, `user_blocks`, `notification_preferences`, `email_outbox`) are completely blocked from direct client read. All data access flows through Express API controllers that project safe, sanitized payloads.

| Database Entity | `anon` Public Role | `authenticated` (Own Row) | `authenticated` (Other User) | `service_role` (Express Backend) | Enforcement & Routing Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.users` | **None** (Revoked) | **SELECT** (`id = auth.uid()`) | **None** (Blocked by RLS) | **Full CRUD** | Self-context read only. Public identity reads use `public.public_profiles` view or `GET /users/:id/public`. Mutations revoked. |
| `public.public_profiles` *(View)*| **None** (Revoked) | **SELECT** (`id, username, role`) | **SELECT** (`id, username, role`) | **Full SELECT** | Safe projection of public identities. Never reveals `email`, `phone`, or credentials. |
| `public.production_profiles` | **None** (Revoked) | **None** (Direct read revoked) | **None** (Direct read revoked) | **Full CRUD** | All reads & updates routed through Express `GET/PUT /production/profile` and `GET /production/profile/:id`. |
| `public.talent_profiles` | **None** (Revoked) | **None** (Direct read revoked) | **None** (Direct read revoked) | **Full CRUD** | All reads & updates routed through Express `GET/PUT /talent/profile` and `GET /talent/profile/:id`. |
| `public.jobs` | **None** (Revoked) | **SELECT** (Drafts + Published) | **SELECT** (Published jobs only) | **Full CRUD** | Authenticated client can select published jobs; production owner reads own drafts. Direct mutations revoked. |
| `public.job_requirements` | **None** (Revoked) | **SELECT** (Corresponding job owner) | **SELECT** (Published jobs only) | **Full CRUD** | Matches parent job visibility rules. Direct mutations revoked. |
| `public.applications` | **None** (Revoked) | **SELECT** (Applicant or job owner) | **None** (Blocked by RLS) | **Full CRUD** | Realtime subscription access for applicant and studio. Status transitions mediated via Express API. |
| `public.notifications` | **None** (Revoked) | **SELECT** (`user_id = auth.uid()`) | **None** (Blocked by RLS) | **Full CRUD** | Realtime feed for notification bell. Marking read mediated via Express API. |
| `public.messages` | **None** (Revoked) | **SELECT** (Thread participant) | **None** (Blocked by RLS) | **Full CRUD** | Direct client writes revoked in `021`. Realtime read allowed for participants; all sending and listing routed via API. |
| `public.user_blocks` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Managed via Express API `/blocks`. Database trigger `trg_check_message_block` rejects blocked messaging. |
| `public.chat_reports` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Managed via Express API `POST /reports` and `GET /admin/reports`. Audit logged. |
| `public.saved_jobs` | **None** (Revoked) | **SELECT** (`talent_profile.user_id`) | **None** (Blocked by RLS) | **Full CRUD** | Direct writes revoked. Managed via Express API `/saved-jobs`. |
| `public.talent_alerts` | **None** (Revoked) | **SELECT** (`user_id = auth.uid()`) | **None** (Blocked by RLS) | **Full CRUD** | Direct writes revoked. Managed via Express API `/talent-alerts`. |
| `public.job_views` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Direct writes and reads revoked. Recorded via Express API `POST /jobs/:id/view`. |
| `public.user_consents` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Direct writes and reads revoked. Managed via Express API `/auth/consent` and `/account/export`. |
| `public.invite_codes` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Public read revoked to eliminate enumeration. Validated solely via server auth logic. |
| `public.admins` | **None** (Revoked) | **None** (Zero client access) | **None** (Zero client access) | **Full CRUD** | Trust table for platform administrators. Service role only. |
| `public.audit_log` | **None** (Revoked) | **None** (Zero client access) | **None** (Zero client access) | **Full CRUD** | Centralized audit log for admin interventions and verifications. Service role only. |
| `public.match_config` | **None** (Revoked) | **SELECT** (Admins in `admins` table) | **None** (Non-admins blocked) | **Full CRUD** | Weights read only by server and verified administrators in `admins`. Non-admins blocked. |
| `public.match_config_audit_logs` | **None** (Revoked) | **None** (Client revoked) | **None** (Client revoked) | **Full CRUD** | Internal auditing table. Service role access only. |
| `public.match_recompute_queue` | **None** (Revoked) | **None** (Client revoked) | **None** (Client revoked) | **Full CRUD** | Asynchronous processing queue. Service role access only. |
| `public.email_outbox` | **None** (Revoked) | **None** (Client revoked) | **None** (Client revoked) | **Full CRUD** | Transactional email delivery queue. Service role access only. |
| `public.skills` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |
| `public.roles` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |
| `public.cities` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |
| `public.skill_aliases` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Normalization synonyms. Direct mutations revoked. |
| `public.talent_credits` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Managed via Express API `/talent/credits`. Service role only. |
| `public.notification_preferences` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Managed via Express API `/settings/notifications` and `/unsubscribe`. |

---

## 5. Complete API Reference (All 86 Endpoints)

Every endpoint receives and responds with `application/json` (except `/account/export` which returns a downloadable JSON file and multipart upload endpoints). Client authentication relies on a valid JWT token (`Bearer <token>`). The server derives identity exclusively from `req.caller` ([server/src/middleware/callerContext.ts](server/src/middleware/callerContext.ts)), rejecting suspended users with `403 Forbidden`.

### 1. System Health (1 Endpoint)
- `GET /health`: Public service liveness check returning `{ status: "ok" }`.

### 2. Authentication & Onboarding (6 Endpoints)
- `POST /auth/register`: Creates new user account; validates email, password strength, username, role, invite code, and mandatory DPDP consent and 18+ age confirmation.
- `POST /auth/verify`: Verifies 6-digit email OTP and issues session tokens.
- `POST /auth/forgot-password`: Dispatches password reset email with secure redirect link.
- `GET /auth/me`: Returns caller authentication identity context.
- `GET /auth/consent-status`: Returns consented policy versions and determines whether re-consent is required.
- `POST /auth/consent`: Records updated consent agreement on policy version increments.

### 3. User Accounts & Data Rights (2 Endpoints)
- `GET /account/export`: Generates structured machine-readable JSON archive of all personal data (rate-limited to 1 request per hour per user).
- `DELETE /account`: Irrevocably deletes user account, cascading through database records and purging storage assets.

### 4. Production Profiles (4 Endpoints)
- `POST /production/profile`: Creates verified production studio profile.
- `GET /production/profile`: Returns authenticated user's own production studio profile.
- `PUT /production/profile`: Updates studio bio, company name, and production metadata.
- `GET /production/profile/:id`: Public studio profile view returning company details, verified badge, and published jobs.

### 5. Jobs Management & Analytics (13 Endpoints)
- `GET /jobs`: Public job catalog with filtering (role, location, job type, skills, pay range, search text) and pagination.
- `POST /jobs`: Creates a draft job posting (Production houses only).
- `GET /jobs/:id`: Detailed view of job posting with structured requirements.
- `PUT /jobs/:id`: Updates job title, description, budget, or dates (`requireJobOwner`).
- `DELETE /jobs/:id`: Deletes or archives job posting (`requireJobOwner`).
- `GET /jobs/:id/my-match`: Calculates pre-apply match score preview and missing skills for authenticated talent.
- `POST /jobs/:id/view`: Records unique job impression for analytics (skips owner's own views; rate-limited).
- `PUT /jobs/:id/requirements`: Configures required skills, roles, and experience levels (`requireJobOwner`).
- `POST /jobs/:id/publish`: Transitions job from draft to published (`requireJobOwner`).
- `POST /jobs/:id/close`: Closes job to new applicants (`requireJobOwner`).
- `GET /jobs/:id/applications`: Lists all submitted candidates ranked by match score (`requireJobOwner`).
- `GET /jobs/:id/analytics`: Returns view count, applicant count, and score distribution (`requireJobOwner`).
- `GET /jobs/:id/talent-matches`: Algorithmic directory recommendations for a job (`requireJobOwner`).

### 6. Talent Profiles, Credits & Media Uploads (14 Endpoints)
- `POST /talent/profile`: Creates initial creative talent profile (skills, role, bio, location).
- `GET /talent/profile`: Returns authenticated user's own talent profile.
- `PUT /talent/profile`: Updates talent profile and enqueues automatic score recomputations.
- `PUT /talent/availability`: Updates work availability status (`open`, `busy`, `unavailable`).
- `GET /talent/profile/:id`: Public talent profile view projecting craft info, credits, and non-sensitive fields.
- `GET /talent/search`: Directory search with multi-skill, location, role, and experience filtering.
- `POST /talent/avatar`: Uploads avatar image (strict 2 MB cap; magic byte validation for JPEG, PNG, WebP; SVG forbidden).
- `POST /talent/resume`: Uploads private PDF resume (strict 5 MB cap; MIME validation).
- `DELETE /talent/resume`: Removes uploaded resume from private storage.
- `GET /talent/:id/resume-url`: Generates short-lived signed download URL for hiring studios with active applications.
- `GET /talent/credits`: Lists verified work credit history for authenticated talent.
- `POST /talent/credits`: Adds verified project credit (title, role, year, production company, description, link).
- `PUT /talent/credits/:id`: Updates an existing credit record (owner only).
- `DELETE /talent/credits/:id`: Deletes a credit record (owner only).

### 7. Applications Pipeline (5 Endpoints)
- `GET /applications/my`: Lists all job applications submitted by authenticated talent user with live status tracking.
- `POST /applications`: Submits a job application with cover note and portfolio links (validates published status).
- `POST /applications/:id/withdraw`: Withdraws an application (applicant talent only).
- `PUT /applications/:id/status`: Transitions pipeline status (`applied` $\rightarrow$ `shortlisted` $\rightarrow$ `interview` $\rightarrow$ `hired` / `rejected`) and sets interview date/time (`requireApplicationAccess('production-owner')`).
- `GET /applications/:id/match-breakdown`: Detailed 7-signal score and reason breakdown accessible to applicant and hiring studio.

### 8. Notifications Feed (4 Endpoints)
- `GET /notifications`: Paginated feed of user notifications.
- `GET /notifications/unread-count`: Returns active unread counter badge.
- `PUT /notifications/read-all`: Marks all notifications as read.
- `PUT /notifications/:id/read`: Marks a specific notification as read.

### 9. Dashboard (1 Endpoint)
- `GET /dashboard/stats`: Returns role-specific platform summary metrics for home dashboard.

### 10. Saved Jobs (4 Endpoints)
- `GET /saved-jobs`: Lists all bookmarked jobs for authenticated talent.
- `POST /saved-jobs`: Bookmarks a job listing.
- `DELETE /saved-jobs/:id`: Removes a specific saved job bookmark.
- `DELETE /saved-jobs`: Removes all bookmarks.

### 11. Talent Alerts (4 Endpoints)
- `GET /talent-alerts`: Lists automated search criteria alerts.
- `POST /talent-alerts`: Creates a new automated search alert with criteria tags.
- `PATCH /talent-alerts/:id`: Toggles alert active status.
- `DELETE /talent-alerts/:id`: Deletes an automated search alert.

### 12. Controlled Film Vocabulary (3 Endpoints)
- `GET /vocab/skills`: Autocomplete search across ~150 canonical film skills (cached).
- `GET /vocab/roles`: Autocomplete search across ~60 film industry roles (cached).
- `GET /vocab/cities`: Autocomplete search across major film production cities (cached).

### 13. Admin Management & Moderation (12 Endpoints)
- `GET /admin/match-config`: Returns current active match weights and cache status (`requireAdmin`).
- `PUT /admin/match-config`: Updates match scoring weights with sum-to-100 validation and audit log (`requireAdmin`).
- `POST /admin/recompute/process`: Triggers background batch processing of `match_recompute_queue` (`requireAdmin`).
- `GET /admin/users`: Lists platform users with filter by role and suspension status (`requireAdmin`).
- `PUT /admin/users/:id/suspend`: Suspends user account and invalidates active sessions (`requireAdmin`).
- `PUT /admin/users/:id/unsuspend`: Restores suspended user account (`requireAdmin`).
- `GET /admin/production`: Lists production profiles with verification status (`requireAdmin`).
- `PUT /admin/production/:id/verify`: Grants official verified studio badge (`requireAdmin`).
- `PUT /admin/production/:id/unverify`: Revokes studio badge (`requireAdmin`).
- `GET /admin/audit-log`: System-wide audit log feed of administrative actions (`requireAdmin`).
- `GET /admin/reports`: Lists chat and conduct abuse reports (`requireAdmin`).
- `PUT /admin/reports/:id`: Resolves or updates abuse report status (`requireAdmin`).

### 14. Public User Directory (1 Endpoint)
- `GET /users/:id/public`: Safe projection returning username and role for user display (never email or phone).

### 15. Messaging & Chat (3 Endpoints)
- `POST /messages`: Sends chat message; enforces block checks, conversation permissions, and rate limits.
- `PUT /messages/read`: Marks messages from a specific sender as read.
- `GET /messages/:otherUserId`: Fetches message history with conversation participant (rate-limited).

### 16. Conversations (1 Endpoint)
- `GET /conversations`: Lists active conversation threads with latest message preview and unread counters.

### 17. Safety & Blocking (3 Endpoints)
- `GET /blocks`: Lists users blocked by authenticated caller.
- `POST /blocks`: Blocks a user; immediately prevents mutual messaging.
- `DELETE /blocks/:userId`: Unblocks a previously blocked user.

### 18. Moderation Reporting (1 Endpoint)
- `POST /reports`: Submits abuse report (spam, harassment, scam, inappropriate, other) with optional message reference.

### 19. Settings & Notification Preferences (2 Endpoints)
- `GET /settings/notifications`: Returns user's granular per-category email preferences and digest frequency.
- `PUT /settings/notifications`: Updates notification preferences.

### 20. Unsubscribe (2 Endpoints)
- `GET /unsubscribe/:token`: Validates token and returns current preferences for one-click unsubscribe page.
- `POST /unsubscribe/:token`: One-click opt-out without requiring user login.

---

## 6. Frontend Client Architecture & Complete Page Catalog

The frontend is a React 18 single-page application built with Vite and Tailwind CSS v3, enforcing modern, accessible film-industry design aesthetics.

### Visual Design System & Palette Tokens
- **Brand Navy (`#0B2545`):** Structural elements, primary navigation, headers, authority emphasis.
- **Film Gold (`#E0A96D`):** Accent highlights, star ratings, primary buttons, match score badges.
- **Surface Neutrals:** `#FFFFFF` (Base card surface), `#F8FAFC` (Section surface), `#E2E8F0` (Borders).
- **Text Tokens:** `#0F172A` (Headings), `#334155` (Body text), `#64748B` (Muted/tertiary).
- **Accessibility:** WCAG AA contrast compliance across all text/background pairings; focus rings; keyboard navigable modals with <kbd>Esc</kbd> dismissal.

### Complete Client Page Catalog (20 Page Modules)

| Page Component | Route Path | Access Level | Description & Core Interactions |
| :--- | :--- | :---: | :--- |
| `Landing.tsx` | `/` | Public | Hero showcase, value proposition for studios and talent, featured roles, CTA, footer links. Redirects authenticated users to `/home`. |
| `Login.tsx` | `/login` | Public | Email and password sign-in, show/hide password toggle, forgot password modal. |
| `Register.tsx` | `/register` | Public | Role selector, invite code input, DPDP terms consent, and **mandatory 18+ age confirmation checkbox**. |
| `Verify.tsx` | `/verify` | Public | 6-box OTP verification with auto-paste clipboard support and expiration timer. |
| `ResetPassword.tsx` | `/reset-password` | Public | Secure password update via Supabase token. |
| `Home.tsx` | `/home` | Protected | Role-aware dashboard: production studio overview with active jobs and applicant metrics; talent overview with active applications and top job matches. |
| `BrowseJobs.tsx` | `/jobs` | Public/Authed | Full searchable job catalog with server-side filters (text, role, location, experience, pay, skills) and URL-synced query params. |
| `JobDetail.tsx` | `/jobs/:id` | Public/Authed | Job specifications; for talent, displays pre-apply **Score Preview Modal** with signal breakdown; apply modal with cover note. |
| `CreateJob.tsx` | `/jobs/create` | Production | 3-step job creation wizard with controlled vocabulary tag pickers, budget ranges, and production dates. |
| `EditJob.tsx` | `/jobs/:id/edit` | Production Owner | Pre-populated job editor allowing full edits to draft jobs and title/type updates to published listings. |
| `Applications.tsx` | `/applications` | Protected | Production pipeline manager (Kanban/table) with stage movement and **Candidate Comparison Modal** (side-by-side explainability). |
| `Search.tsx` | `/search` | Protected | Creative talent directory with multi-tag filtering, location toggles, and verified credit previews. |
| `CompanyDetail.tsx` | `/company/:id` | Public/Authed | Public studio profile featuring company biography, verified studio badge, and active job listings. |
| `SavedJobs.tsx` | `/saved-jobs` | Talent | List of bookmarked jobs with studio link, pay badge, and instant remove action. |
| `Alerts.tsx` | `/alerts` | Production | Automated candidate alert management with active toggle, criteria summary, and deletion. |
| `Chat.tsx` | `/chat` | Protected | Real-time negotiation messaging, unread badges, user blocking, and abuse reporting. |
| `Profile.tsx` | `/profile` | Protected | View/edit profile, avatar upload (magic byte validation), resume management, and verified work credits CRUD. |
| `Settings.tsx` | `/settings` | Protected | Notification preferences, data export (`Download my data`), consent status display, and two-step permanent account erasure. |
| `Admin.tsx` | `/admin` | Admins Only | System management dashboard: match engine weights editor, user suspension, studio verification, report moderation, and audit logs. |
| `Unsubscribe.tsx` | `/unsubscribe/:token` | Public (Token) | One-click email notification preference management and unsubscribe without requiring user login. |
| `Privacy.tsx`, `Terms.tsx`, `Cookies.tsx`, `Contact.tsx` | `/privacy`, `/terms`, `/cookies`, `/contact` | Public | Statutory notices, DPDP Grievance Officer details, sub-processor disclosures, and cookie policies. |
| `NotFound.tsx` | `*` | Public | 404 error page with navigation to Home. |

---

## 7. Compliance, Age Gate & Data Rights (Design References)

> **CRITICAL LEGAL NOTICE: PENDING COUNSEL VERIFICATION**  
> All statutory citations below are maintained strictly as **technical design references** and are marked **pending counsel verification** per [docs/LEGAL_TODO.md](docs/LEGAL_TODO.md) until signed off by qualified legal counsel. Sections 5, 6, 9, 11, 12, and 13 of India's Digital Personal Data Protection Act, 2023 (DPDP Act) are design benchmarks, not formal statements of legal compliance.

### Statutory Design Reference Matrix

| Statutory Section (Reference Only) | Regulatory Principle | Technical Implementation in CineConnect |
| :--- | :--- | :--- |
| **DPDP Act §5** | Notice prior to collection | Dedicated `/privacy` page disclosing data fiduciaries, purposes of processing, retention periods, and sub-processors (Supabase, Fly.io, Vercel, Resend, Sentry). |
| **DPDP Act §6** | Valid affirmative consent | Affirmative, un-ticked checkboxes on `/register`. Versioned audit records stored in `public.user_consents`. |
| **DPDP Act §6(4)** | Right to withdraw consent | Accessible through Profile Settings (`/settings`) and inline account controls. |
| **DPDP Act §9** | Processing of children's data | **Mandatory 18+ age confirmation checkbox** validated at registration. Child talent onboarding is **strictly out of scope for v1** and deferred until formal parental consent flows are designed with counsel. |
| **DPDP Act §11** | Right to access personal data | `GET /account/export` compiles an organized machine-readable JSON bundle. Rate-limited to 1 request per hour per user. |
| **DPDP Act §12** | Right to correction and erasure | Profile editing and `DELETE /account` cascading purge removing database rows and storage objects. |
| **DPDP Act §13** | Grievance redressal mechanism | Dedicated `/contact` page with appointed Grievance Officer details (`grievance@cineconnect.in`), physical Mumbai address, and 24-hour acknowledgement SLA. |

### Technical Consent & Retention Purge Safeguards
1. **Consent Audit Record:** Registration captures `{ user_id, terms_version, privacy_version, age_confirmed, ip_address, user_agent, consented_at }` in `public.user_consents`.
2. **Evidentiary Retention Period:** In accordance with the Privacy Policy ([client/src/pages/Privacy.tsx](client/src/pages/Privacy.tsx)), network identifiers (IP address and browser user-agent) are retained for exactly **180 days (6 months)** as technical proof of consent.
3. **Automated Anonymization Purge:** The scheduled retention worker executes `purgeOldConsentMetadata(180)` in [server/src/services/retentionService.ts](server/src/services/retentionService.ts), nullifying the IP address and user-agent fields after 180 days while permanently preserving the non-identifying consent record, versions, and timestamp.
4. **General Data Retention:** Read notifications are purged after **90 days**; transient email outbox delivery rows are purged after **30 days**.

---

## 8. Security Hardening & Zero-Trust Safeguards

### 1. Zero-Trust Caller Identity
- User and profile IDs are **never accepted from request bodies or URL parameters** where ownership is required.
- All authenticated controllers derive caller context (`userId`, `talentProfileId`, `productionProfileId`, `isAdmin`, `isSuspended`) exclusively from validated Supabase JWTs ([server/src/middleware/callerContext.ts](server/src/middleware/callerContext.ts)).

### 2. File Upload Hardening
- **Avatar Uploads:** Handled exclusively via Express API ([server/src/services/storageService.ts](server/src/services/storageService.ts)). Enforces strict **2 MB limit**, magic byte sniffing (JPEG, PNG, WebP only), and **explicitly blocks SVG files** to eliminate stored Cross-Site Scripting (XSS).
- **Resume Uploads:** Handled via Express API. Enforces strict **5 MB limit** and PDF MIME type checking; files are stored in a private bucket accessible only via short-lived signed URLs generated for hiring production teams.

### 3. Edge Hardening & Graceful Shutdown
- **Fly.io Production Machines:** Configured in [server/fly.toml](server/fly.toml) with `min_machines_running = 2` for high availability and zero-downtime rolling deploys.
- **Graceful Shutdown:** Express server handles `SIGTERM` and `SIGINT` ([server/src/index.ts](server/src/index.ts)), calling `server.close()` to stop accepting new requests, draining in-flight connections with a 15-second safety deadline.
- **Reverse Proxy Trust:** `app.set("trust proxy", 1)` accurately extracts client IPs behind Fly.io Anycast proxies for rate-limiting.
- **CORS Validation:** Startup terminates immediately (`process.exit(1)`) in production if `ALLOWED_ORIGINS` contains wildcards (`*`) or is unconfigured.

---

## 9. Verification, Test Suites & Operational Runbooks

### 9.1 Automated Test Suite Breakdown (396 Passing Tests)

The repository maintains **396 automated tests across 33 test files** with a 100% pass rate:

- **Backend Test Suite (348 Tests across 24 Test Files):**
  - Match engine scoring, weights validation, NFKD normalization, and explainability (`matchScore.test.ts`, `recomputeService.test.ts`)
  - Authentication, password rules, OTP validation, and statutory age gate (`authController.test.ts`)
  - Admin trust, suspended user blocking, studio verification, and audit trail (`adminTrustAndAudit.test.ts`, `adminController.test.ts`)
  - Chat safety, block enforcement, and report workflows (`chatSafety.test.ts`)
  - Talent depth, credit history, and upload validators (`talentDepthAndUploads.test.ts`, `storageService.test.ts`)
  - Email preferences, outbox retry backoff, and unsubscribe tokens (`emailSystem.test.ts`)
  - Data rights, cascading deletion, and automated retention purges (`accountService.test.ts`, `retentionService.test.ts`)
  - Row-Level Security lockdown verification against PostgREST (`rlsLockdown.test.ts`, `privilegeEscalation.integration.test.ts`)
- **Frontend Test Suite (48 Tests across 9 Test Files):**
  - Registration validation, consent acceptance, and 18+ age gate error states (`Register.test.tsx`)
  - Authentication sign-in and loading states (`Login.test.tsx`)
  - Protected route access control and unauthenticated redirects (`RoleRestrictions.test.tsx`)
  - Core page rendering and user interactions (`Landing.test.tsx`, `BrowseJobs.test.tsx`, `CompanyDetail.test.tsx`, `SavedJobs.test.tsx`, `EditJob.test.tsx`, `Alerts.test.tsx`)

### 9.2 Operational Reference Documents

1. [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md): Environment topology, Staging vs Production Supabase project isolation, Fly.io machine specs, and complete inventory of environment variable names only (zero secrets committed).
2. [docs/RLS_MATRIX.md](docs/RLS_MATRIX.md): Comprehensive 27-table database permission matrix and storage bucket access rules.
3. [docs/LEGAL_TODO.md](docs/LEGAL_TODO.md): Formal statutory checklist for Indian legal counsel sign-off with all citations marked pending verification.
4. [docs/GAP_REPORT.md](docs/GAP_REPORT.md): Historical reconciliation audit documenting the resolution of legacy documentation gaps.
5. [docs/LAUNCH.md](docs/LAUNCH.md): Deployment checklist, smoke test verification, and CLI rollback commands.
6. [docs/EMAIL_DNS.md](docs/EMAIL_DNS.md): SPF, DKIM, and DMARC staged configuration guidelines.
