# CineConnect — Row-Level Security (RLS) & Access Control Matrix

This matrix formalizes the database access permissions and row-level security (RLS) policies established in `supabase/migrations/018_rls_lockdown.sql`.

## Guiding Security Principles

1. **Server-As-Sole-Writer**: All database inserts, updates, and deletes are revoked from `anon` and `authenticated` roles at the SQL privilege level. The Express backend server using the `service_role` key is the sole authorized writer.
2. **Minimal Client SELECT**: Direct client queries (`supabase.from(...)`) are permitted solely for Supabase Realtime subscriptions (`messages`, `notifications`, `applications`) and public read-only controlled vocabularies (`skills`, `roles`, `cities`, `skill_aliases`).
3. **No Direct Sensitive Data Exposure**: Tables containing private identity information (`users`, `production_profiles`, `talent_profiles`, `invite_codes`, `user_consents`, `job_views`) cannot be read directly by clients; all reads flow through Express API endpoints that project only non-sensitive columns.

---

## Access Control Matrix (All 24 Tables)

| Table | `anon` Access | `authenticated` (Own Row) | `authenticated` (Other User) | `service_role` (Express Backend) | Primary Access Channel & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.users` | **None** (Privileges Revoked) | **SELECT** (Own row only via `auth.uid() = id`) | **None** (Blocked by RLS) | **Full CRUD** | Self-row read for auth context. Other user display names read via `public.public_profiles` view or `GET /users/:id/public`. Writes revoked. |
| `public.public_profiles` (View) | **None** (Revoked from anon) | **SELECT** (`id, username, role`) | **SELECT** (`id, username, role`) | **Full SELECT** | Safe projection of public identities. Never returns `email`, `phone`, or credentials. |
| `public.production_profiles` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | All reads & updates routed through `GET/PUT /production/profile` and `GET /production/profile/:id`. |
| `public.talent_profiles` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | All reads & updates routed through `GET/PUT /talent/profile` and `GET /talent/profile/:id`. |
| `public.jobs` | **None** (Revoked) | **SELECT** (Drafts + Published) | **SELECT** (Published jobs only) | **Full CRUD** | Authenticated client can select published jobs; production owners can see own drafts. Direct writes revoked. Public views use Express API. |
| `public.job_requirements` | **None** (Revoked) | **SELECT** (Corresponding job owner) | **SELECT** (Published jobs only) | **Full CRUD** | Matches parent job visibility rules. Direct writes revoked. |
| `public.applications` | **None** (Revoked) | **SELECT** (Applicant talent or job owner) | **None** (Blocked by RLS) | **Full CRUD** | Realtime subscription access for applicant and hiring production team. Direct writes revoked. |
| `public.notifications` | **None** (Revoked) | **SELECT** (`auth.uid() = user_id`) | **None** (Blocked by RLS) | **Full CRUD** | Realtime subscription access for user's notification bell. Marking read routed through Express API. |
| `public.messages` | **None** (Revoked) | **SELECT** (Realtime participant read) | **SELECT** (If thread participant) | **Full CRUD** | Milestone M4 / Migration 021: Direct client write permanently revoked. All message sending, listing, and read marking run through Express API. |
| `public.user_blocks` | **None** (Revoked) | **None** (Zero client access) | **None** (Zero client access) | **Full CRUD** | Migration 020: Managed via Express `/blocks`. DB trigger `trg_check_message_block` rejects blocked inserts. |
| `public.chat_reports` | **None** (Revoked) | **None** (Zero client access) | **None** (Zero client access) | **Full CRUD** | Migration 020: Managed via Express `/reports` and `/admin/reports`. Audit logged. |
| `public.saved_jobs` | **None** (Revoked) | **SELECT** (`auth.uid() = talent_profile.user_id`) | **None** (Blocked by RLS) | **Full CRUD** | Direct writes revoked. Managed via Express API `/saved-jobs`. |
| `public.talent_alerts` | **None** (Revoked) | **SELECT** (`auth.uid() = user_id`) | **None** (Blocked by RLS) | **Full CRUD** | Direct writes revoked. Managed via Express API `/talent-alerts`. |
| `public.job_views` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Direct writes and reads revoked. Recorded via Express API `POST /jobs/:id/view`. |
| `public.user_consents` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Direct writes revoked. Managed via Express API `/auth/consent` and `/account/export`. |
| `public.invite_codes` | **None** (Revoked) | **None** (Direct client revoked) | **None** (Direct client revoked) | **Full CRUD** | Public read dropped. Codes validated solely by server auth logic. Rotated via `scripts/rotate-invite-codes.ts`. |
| `public.admins` | **None** (Revoked) | **None** (Zero client access) | **None** (Zero client access) | **Full CRUD** | Milestone M6 trust table. Service role access only. No client SELECT or mutation. |
| `public.audit_log` | **None** (Revoked) | **None** (Zero client access) | **None** (Zero client access) | **Full CRUD** | System-wide audit log for admin interventions and verifications. Service role only. |
| `public.match_config` | **None** (Revoked) | **SELECT** (Admins in `admins` table only) | **None** (Non-admins blocked) | **Full CRUD** | Algorithm weights read only by server and verified administrators in `public.admins`. |
| `public.match_config_audit_logs` | **None** (Revoked) | **None** (Client revoked) | **None** (Client revoked) | **Full CRUD** | Internal auditing table. Service role access only. |
| `public.match_recompute_queue` | **None** (Revoked) | **None** (Client revoked) | **None** (Client revoked) | **Full CRUD** | Internal asynchronous processing queue. Service role access only. |
| `public.email_outbox` | **None** (Revoked) | **None** (Client revoked) | **None** (Client revoked) | **Full CRUD** | Internal email delivery queue. Service role access only. |
| `public.skills` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |
| `public.roles` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |
| `public.cities` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |
| `public.skill_aliases` | **SELECT** (Public Read) | **SELECT** | **SELECT** | **Full CRUD** | Controlled vocabulary autocomplete. Direct mutations revoked. |

---

## Storage Bucket Isolation

| Bucket | Visibility | Direct Client Read | Direct Client Write | Backend Service Role Access | Security Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `avatars` | **Public** | **Allowed** (Images only: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) | **Blocked** (Finalized in 4C-3) | **Full CRUD** | Sanitized image types only. SVGs forbidden to prevent stored XSS. |
| `resumes` | **Private** | **Blocked** (Zero direct client read) | **Blocked** (Finalized in 4C-3) | **Full CRUD** | Confidential candidate CVs. Served strictly through short-lived signed URLs. |

---

## Future Table Safeguards

`ALTER DEFAULT PRIVILEGES IN SCHEMA public` revokes all default permissions for `anon` and `authenticated`. Any future table created in `public` without explicit grants defaults to **zero client access**.
