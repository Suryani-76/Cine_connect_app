# CineConnect — Environments & Deployment Reference

This document outlines the architecture, environment variables, Supabase projects, and deployment lifecycles for CineConnect.

> **CRITICAL SECURITY RULE:** This document contains **environment variable and secret names only**. Never commit actual secret values, tokens, credentials, or private connection strings to version control.

---

## 1. Environment Topology

| Environment | Purpose | Target Branch | Hosting / Infra | Supabase Project |
|---|---|---|---|---|
| **Local** | Feature development and unit tests | Feature branches | `localhost:3000` (API), `localhost:5173` (Client) | Local Supabase Docker (`127.0.0.1:54321`) |
| **CI** | Type-checking, unit/integration test suites, security scans | Pull Requests | GitHub Actions (`ubuntu-latest`) | Ephemeral local Supabase instance |
| **Staging** | Pre-production testing, QA validation, smoke testing | `main` | Fly.io app `cineconnect-server-staging` (`bom`), Staging Client CDN | Dedicated Staging Supabase Project |
| **Production** | Live production traffic, high-availability crew hiring | `production` (manual approval gate) | Fly.io app `cineconnect-server` (`bom`, 2+ machines), Production CDN | Dedicated Production Supabase Project |

---

## 2. Supabase Projects

Staging and Production use completely separate, isolated Supabase projects to ensure database operations, user accounts, and test data never bleed into production.

### Staging Supabase Project
- **Purpose:** Full integration testing with realistic data, candidate alerts, and transactional email testing.
- **Database:** Dedicated PostgreSQL instance on Supabase.
- **Auth:** Isolated auth schema; user emails and SMS testing sandbox.
- **Storage Buckets:** `avatars` (public read, authenticated write via API), `resumes` (private, authenticated read/write).
- **Migration Strategy:** Migrations in `supabase/migrations/` are applied automatically by CI/CD on every merge to `main`.

### Production Supabase Project
- **Purpose:** Live Indian film industry crew and production house marketplace.
- **Database:** Dedicated PostgreSQL instance with point-in-time recovery (PITR) and automated backups.
- **Auth:** Rate-limited production auth with verified studio badges.
- **Storage Buckets:** `avatars`, `resumes` with strict mime-type validation and 2MB caps.
- **Migration Strategy:** Migrations in `supabase/migrations/` are applied during the production deployment pipeline immediately before server rollout, gated behind manual approval.

---

## 3. Environment Variable Inventory (Names Only)

### Server Runtime Variables & Secrets (`server/.env` / Fly.io secrets)

| Variable Name | Environment | Required | Description |
|---|---|---|---|
| `PORT` | All | Yes | HTTP port for Express server (default `3000`) |
| `NODE_ENV` | All | Yes | Environment mode (`development`, `staging`, `production`, `test`) |
| `ALLOWED_ORIGINS` | Staging, Prod | Yes | Comma-separated list of allowed client CORS origins |
| `SUPABASE_URL` | All | Yes | URL of target Supabase project API gateway |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Yes | Service role JWT key (grants administrative database bypass) |
| `RESEND_API_KEY` | Staging, Prod | Yes | API key for transactional email provider (Resend) |
| `EMAIL_FROM` | Staging, Prod | Yes | Verified sending email address (e.g. notifications@domain) |
| `APP_URL` | All | Yes | Base URL of web client for email action links |
| `INTERNAL_HEALTH_SECRET` | Staging, Prod | Optional | Shared secret header for deep health check inspections |
| `SENTRY_DSN` | Staging, Prod | Optional | Error reporting and tracing DSN for Express backend |

### Client Runtime Variables (`client/.env`)

| Variable Name | Environment | Required | Description |
|---|---|---|---|
| `VITE_API_URL` | All | Yes | Base URL of backend Express API |
| `VITE_SUPABASE_URL` | All | Yes | Public Supabase URL (used for Realtime channels) |
| `VITE_SUPABASE_ANON_KEY` | All | Yes | Public anonymous API key for Realtime WebSocket auth |
| `VITE_SENTRY_DSN` | Staging, Prod | Optional | Error reporting DSN for React frontend |

### CI/CD Pipeline Secrets & Variables (GitHub Actions)

| Name | Type | Scope | Description |
|---|---|---|---|
| `FLY_API_TOKEN` | Secret | Repository | Fly.io deploy token with write access to apps |
| `STAGING_SUPABASE_DB_URL` | Secret | Environment (`staging`) | Direct PostgreSQL connection string for staging migrations |
| `PROD_SUPABASE_DB_URL` | Secret | Environment (`production`) | Direct PostgreSQL connection string for production migrations |
| `STAGING_SMOKE_AUTH_TOKEN` | Secret | Environment (`staging`) | Synthetic test user token for staging smoke tests |
| `PROD_SMOKE_AUTH_TOKEN` | Secret | Environment (`production`) | Synthetic test user token for production smoke tests |
| `STAGING_API_URL` | Variable | Environment (`staging`) | Staging API endpoint for smoke testing |
| `PROD_API_URL` | Variable | Environment (`production`) | Production API endpoint for smoke testing |
| `STAGING_APP_URL` | Variable | Environment (`staging`) | Staging client URL |
| `PROD_APP_URL` | Variable | Environment (`production`) | Production client URL |

---

## 4. Fly.io Machine Configuration

### Staging (`server/fly.staging.toml`)
- **App Name:** `cineconnect-server-staging`
- **Region:** `bom` (Mumbai)
- **Min Machines Running:** `1`
- **Auto-stop / Auto-start:** Enabled
- **Shutdown Signal:** `SIGTERM` with `20s` drain window
- **Concurrency:** `hard_limit = 200`, `soft_limit = 150` (connections)

### Production (`server/fly.toml`)
- **App Name:** `cineconnect-server`
- **Region:** `bom` (Mumbai)
- **Min Machines Running:** `2` (Guarantees zero-downtime rolling deploys and redundancy)
- **Auto-stop / Auto-start:** Enabled
- **Shutdown Signal:** `SIGTERM` with `20s` drain window
- **Concurrency:** `hard_limit = 250`, `soft_limit = 200` (connections)
- **Health Checks:** Periodic HTTP GET to `/health` with 15s interval, 5s timeout, 10s grace period.

---

## 5. Deployment Lifecycle & Promotion Flow

```
[Feature Branch / PR]
       ↓
[CI: Test + TypeCheck + Table Refs + Gitleaks]
       ↓
[Merge to 'main']
       ↓
[Staging Deploy Pipeline]
  1. Run Tests
  2. Apply Staging Migrations (Stop on failure)
  3. Deploy Server (fly.staging.toml)
  4. Deploy Client (Staging env)
  5. Smoke Test (/health + authed read)
  6. Print rollback instructions if failed
       ↓
[QA & Acceptance Verification]
       ↓
[Promote to 'production' Branch]
       ↓
[Manual Approval Gate in GitHub Environment]
       ↓
[Production Deploy Pipeline]
  1. Run Tests
  2. Apply Production Migrations (Stop on failure)
  3. Deploy Server (fly.toml with min_machines=2)
  4. Deploy Client (Production env)
  5. Smoke Test (/health + authed read)
  6. Print rollback instructions if failed
```
