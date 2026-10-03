# CineConnect Production Launch Runbook

> **NOTICE:** DRAFT — review by engineering lead, DevOps, and legal counsel prior to production deployment.

This runbook defines the operational readiness procedures, launch day timeline, rollback scripts, first-week monitoring protocols, and feature flags for launching CineConnect in India (`bom` region).

---

## 1. Pre-Launch Readiness Checklist

Complete each verification step before initiating production cutover:

- [ ] **Legal & Compliance Sign-Off:**
  - [ ] Terms of Service and Privacy Policy reviewed and signed off by Indian legal counsel (per `docs/LEGAL_TODO.md`).
  - [ ] Designated Grievance Officer name, email (`grievance@cineconnect.in`), and postal address updated in `/contact` and `/privacy`.
  - [ ] DPDP §6 consent check verified on `/register` (affirmative un-ticked checkbox, versioned record created in `user_consents`).
- [ ] **DNS & Email Deliverability (`docs/EMAIL_DNS.md`):**
  - [ ] SPF TXT record active (`v=spf1 include:resend.com include:amazonses.com ~all`).
  - [ ] DKIM selector CNAME records active and verified in Resend dashboard.
  - [ ] DMARC record set to Monitoring Mode (`p=none; rua=mailto:dmarc-reports@cineconnect.in`).
  - [ ] Supabase Custom SMTP credentials configured and test OTP received in primary Gmail inbox.
- [ ] **Security & Production Hardening:**
  - [ ] Server `ALLOWED_ORIGINS` strictly set to `https://cineconnect.in` (startup fails if empty or wildcard).
  - [ ] `app.set('trust proxy', 1)` active behind Fly.io Mumbai Anycast proxy.
  - [ ] Storage policies active: `avatars` bucket enforces 2 MB limit + blocks SVGs; `resumes` bucket private.
  - [ ] CSP and security headers active in `client/vercel.json`.
  - [ ] CI workflow runs `npm audit` and `gitleaks` on all commits.
  - [ ] Rate limits verified: `/auth/register` (5/hr/IP), `/account/export` (1/hr/user).
- [ ] **Infrastructure & Data Layer:**
  - [ ] Supabase Point-in-Time Recovery (PITR) and daily automated backups verified.
  - [ ] Migrations 001–016 applied cleanly to production database without errors.
  - [ ] Minimum 2 Fly.io machines provisioned in `bom` (Mumbai) region (`fly scale count 2 --region bom`).
  - [ ] Sentry DSN configured for server and client error monitoring.
  - [ ] Status page configured (e.g. `status.cineconnect.in` via BetterUptime or Instatus).
  - [ ] Support inbox (`support@cineconnect.in`) and Grievance inbox monitored with notifications.
- [ ] **Seed Content & Soft Launch:**
  - [ ] Curated seed jobs imported via `scripts/import-content.ts --jobs=seed/jobs.csv`.
  - [ ] VIP Production house invitation codes generated in `invite_codes` table.
  - [ ] `INVITE_ONLY` mode set to `true` for initial 48-hour VIP soft launch.

---

## 2. Launch Day Plan (Execution Order of Operations)

### T-4 Hours: Final Staging Smoke Test
1. Execute full load test suite on staging:
   ```bash
   TARGET_URL=https://staging-api.cineconnect.in k6 run loadtest/suite.js
   ```
2. Verify p95 < 400ms and 0% errors.

### T-2 Hours: Production Database Migration
1. Apply pending migrations using Supabase CLI with direct DB URL:
   ```bash
   supabase db push --db-url "$PRODUCTION_DB_URL"
   ```
2. Run database sanity queries:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('user_consents', 'invite_codes', 'email_outbox');
   ```

### T-1 Hour: Backend Deployment (Fly.io Mumbai)
1. Deploy server to Fly.io:
   ```bash
   fly deploy --config server/fly.toml --app cineconnect-api-prod --region bom
   ```
2. Check machine health and proxy logs:
   ```bash
   fly status --app cineconnect-api-prod
   fly logs --app cineconnect-api-prod
   ```
3. Verify production health endpoint:
   ```bash
   curl -I https://api.cineconnect.in/health
   # Expected: HTTP/1.1 200 OK
   ```

### T-30 Minutes: Frontend Deployment (Vercel)
1. Deploy frontend production build:
   ```bash
   vercel --prod
   ```
2. Verify security headers:
   ```bash
   curl -I https://cineconnect.in | grep -E "Content-Security-Policy|Strict-Transport-Security|X-Frame-Options"
   ```

### T-0: DNS Cutover & Traffic Release
1. Route production domain `cineconnect.in` to Vercel and `api.cineconnect.in` to Fly.io Anycast IPv4/IPv6.
2. Team dashboard assignments:
   - **Lead Engineer:** Monitors Fly.io metrics (CPU, RAM, HTTP latency, machine restart count).
   - **Frontend Engineer:** Monitors Sentry real-time client error stream and Vercel analytics.
   - **Product / Ops:** Tests live onboarding flow (Register -> Consent -> OTP -> Profile -> Job Post).

---

## 3. Rollback Procedures & Commands

If any critical failure condition is met, initiate immediate rollback:

### Rollback Criteria:
- Unhandled 500 error rate exceeds **2.0%** over a 5-minute window.
- p95 API response time exceeds **1,500 ms** for > 3 minutes.
- Sentry alerts on auth token issuance or DB connection exhaustion.
- Critical data loss or privacy exposure reported.

### 3.1 Server Rollback (Fly.io)
Revert to the previous known good Docker image release:
```bash
# List recent releases
fly releases --app cineconnect-api-prod

# Rollback to previous version (e.g., v42)
fly deploy --image registry.fly.io/cineconnect-api-prod:deployment-42 --app cineconnect-api-prod
```

### 3.2 Client Rollback (Vercel)
Instantly promote the previous stable production deployment:
```bash
# Promote prior deployment ID
vercel rollback [DEPLOYMENT_ID] --yes
```

### 3.3 Database Rollback (Migration 016)
If migration 016 causes schema lockup or issues, execute rollback SQL:
```sql
DROP INDEX IF EXISTS idx_jobs_published_created;
DROP INDEX IF EXISTS idx_applications_talent_status;
DROP INDEX IF EXISTS idx_applications_job_status;
DROP INDEX IF EXISTS idx_talent_profiles_role_active;
DROP TABLE IF EXISTS email_outbox CASCADE;
DROP TABLE IF EXISTS invite_codes CASCADE;
DROP TABLE IF EXISTS user_consents CASCADE;
```

---

## 4. First-Week Post-Launch Monitoring Protocol

### 4.1 Daily Metrics Review (9:00 AM IST)
- **Registrations & Conversion:**
  - `signup_started` vs `signup_completed` (target conversion > 70%).
  - OTP deliverability and verification completion rate.
- **Match Engine Quality:**
  - Number of applications submitted per published job.
  - Distribution of match scores (target bell curve peaking between 65–85).
  - Production house shortlist / interview rate.
- **System Health:**
  - Fly.io average RAM usage (< 75% of 512MB machine size).
  - Postgres DB connection pool utilization (< 40 connections).
  - Storage bucket usage (resumes and avatars).

### 4.2 Match Weights Tuning from Real Interaction Data
If production houses report mismatched talent recommendations:
1. Query match score audit logs:
   ```sql
   SELECT score, match_breakdown FROM applications WHERE created_at > now() - interval '3 days' ORDER BY created_at DESC LIMIT 50;
   ```
2. Tune weights using the Admin API without redeploying code:
   ```bash
   PUT /admin/match-config
   {
     "skills_match": 35,
     "role_match": 25,
     "experience_match": 15,
     "language_match": 10,
     "location_proximity": 5,
     "profile_completeness": 5,
     "activity_recency": 5,
     "reason": "Increased skills and role weight based on Week 1 director feedback"
   }
   ```
3. Trigger recomputation queue:
   ```bash
   POST /admin/recompute/process?batch_size=100
   ```

---

## 5. Feature Flags & Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `INVITE_ONLY` | Boolean | `false` | When `true`, requires a valid invite code from `invite_codes` table to register. |
| `CAPTCHA_ENABLED` | Boolean | `false` | When `true`, enforces Cloudflare Turnstile token validation on auth routes. |
| `TURNSTILE_SECRET_KEY` | String | `""` | Cloudflare Turnstile backend secret key. |
| `ANALYTICS_ENABLED` | Boolean | `false` | When `true`, activates client analytics (only fires if user accepted cookies). |
| `ALLOWED_ORIGINS` | String | (Required) | Comma-separated allowlist of origins (e.g. `https://cineconnect.in`). |
| `NODE_ENV` | String | `production` | Production environment flag; enforces strict CORS and cookie security. |
| `PORT` | Number | `3000` | Port listened to by Express server. |
