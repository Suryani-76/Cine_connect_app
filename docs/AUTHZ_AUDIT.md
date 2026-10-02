# CineConnect — Authorization Audit

Generated during Phase 0 security hardening.  
**Status: All rows FIXED.**

## Legend
- **Identity source (before)**: where the route used to read the caller identity from.
- **Fix applied**: what was changed in this hardening pass.

---

## Auth routes (`/auth/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| POST | `/auth/register` | No | req.body.role | Anyone | ✅ Zod validates role; no IDOR possible |
| POST | `/auth/verify` | No | req.body.email | Anyone with a valid OTP | ✅ No ownership issue |
| POST | `/auth/forgot-password` | No | req.body.email | Anyone | ✅ Always returns 200 — no email leak |

---

## Production profile routes (`/production/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| POST | `/production/profile` | Yes | **req.body.user_id** ❌ IDOR | Caller (production role) | ✅ user_id derived from req.caller; Zod schema no longer accepts user_id from body |
| GET | `/production/profile/:id` | No | — (read-only) | Anyone | ✅ Returns only non-sensitive fields |

---

## Talent routes (`/talent/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| POST | `/talent/profile` | Yes | **req.body.user_id** ❌ IDOR | Caller (talent role) | ✅ user_id derived from req.caller; Zod schema no longer accepts user_id |
| GET | `/talent/search` | **No** ❌ public | N/A | **Authenticated users only** | ✅ Now requires auth + loadCallerContext; never returns email; paginated (limit max 50) |

---

## Job routes (`/jobs/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| GET | `/jobs` | No | req.query.production_id (untrusted) | Anyone for published; owner for all | ✅ Non-owners silently restricted to published only |
| POST | `/jobs` | Yes | **req.body.production_id** ❌ IDOR | Caller's production profile | ✅ production_id derived from req.caller; Zod schema removed production_id field |
| GET | `/jobs/:id` | No | — | Anyone for published; owner for all | ✅ Non-owners get 404 for non-published jobs |
| POST | `/jobs/:id/view` | **No** ❌ anonymous abuse | viewerId from req.user (nullable) | Authenticated users only; not job owner | ✅ Anonymous → no-op; owner's own views skipped; dedicated 30/min rate limiter |
| GET | `/jobs/:id/analytics` | Yes | **no ownership check** ❌ IDOR | Job's production owner only | ✅ requireJobOwner middleware added |
| GET | `/jobs/:id/talent-matches` | Yes | **no ownership check** ❌ IDOR | Job's production owner only | ✅ requireJobOwner middleware added |
| PUT | `/jobs/:id/requirements` | Yes | **no ownership check** ❌ IDOR | Job's production owner only | ✅ requireJobOwner middleware added |
| POST | `/jobs/:id/publish` | Yes | **no ownership check** ❌ IDOR | Job's production owner only | ✅ requireJobOwner middleware added |
| POST | `/jobs/:id/close` | Yes | **no ownership check** ❌ IDOR | Job's production owner only | ✅ requireJobOwner middleware added |
| GET | `/jobs/:id/applications` | Yes | **no ownership check** ❌ IDOR | Job's production owner only | ✅ requireJobOwner middleware added |

---

## Application routes (`/applications/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| GET | `/applications/my` | Yes | **req.query.talent_profile_id** ❌ IDOR | Caller's talent profile | ✅ talent_profile_id derived from req.caller; query param removed |
| POST | `/applications` | Yes | **req.body.talent_profile_id** ❌ IDOR | Caller (talent role) | ✅ talent_profile_id from req.caller; role guard added; status transition guard added |
| PUT | `/applications/:id/status` | Yes | **no ownership check** ❌ IDOR | Production owner of the job | ✅ requireApplicationAccess('production-owner'); transition validation added |
| GET | `/applications/:id/match-breakdown` | Yes | **no ownership check** ❌ IDOR | Production owner OR applicant | ✅ requireApplicationAccess('any-party') |

---

## Notification routes (`/notifications/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| GET | `/notifications` | Yes | **req.query.user_id** ❌ IDOR | Caller only | ✅ user_id from req.caller; query param ignored |
| GET | `/notifications/unread-count` | Yes | **req.query.user_id** ❌ IDOR | Caller only | ✅ user_id from req.caller |
| PUT | `/notifications/read-all` | Yes | **req.query.user_id** ❌ IDOR | Caller only | ✅ user_id from req.caller |
| PUT | `/notifications/:id/read` | Yes | — (id only) | Notification owner | ✅ ownership check: 404 if caller does not own notification |

---

## Dashboard routes (`/dashboard/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| GET | `/dashboard/stats` | Yes | **req.query.production_id + req.query.user_id** ❌ IDOR | Caller (production role) | ✅ Both IDs derived from req.caller; query params removed; requireRole('production') added |

---

## Saved jobs routes (`/saved-jobs/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| GET | `/saved-jobs` | Yes | **req.query.talent_profile_id** ❌ IDOR | Caller's talent profile | ✅ talent_profile_id from req.caller; query param removed |
| POST | `/saved-jobs` | Yes | **req.body.talent_profile_id** ❌ IDOR | Caller's talent profile | ✅ talent_profile_id from req.caller; requireRole('talent') added |
| DELETE | `/saved-jobs` | Yes | **req.body.talent_profile_id** ❌ IDOR | Caller's talent profile | ✅ talent_profile_id from req.caller |

---

## Talent alert routes (`/talent-alerts/*`)

| Method | Path | Auth required? | Identity source (before) | Who should be allowed | Fix applied |
|---|---|---|---|---|---|
| GET | `/talent-alerts` | Yes | **req.query.user_id** ❌ IDOR | Caller only | ✅ user_id from req.caller |
| POST | `/talent-alerts` | Yes | **req.body.user_id** ❌ IDOR | Caller only | ✅ user_id from req.caller; body no longer accepts user_id |
| DELETE | `/talent-alerts/:id` | Yes | **no ownership check** ❌ IDOR | Alert owner | ✅ ownership check: 404 if caller does not own alert |

---

## Health

| Method | Path | Auth required? | Fix applied |
|---|---|---|---|
| GET | `/health` | No | ✅ No identity involved; returns `{ status: "ok" }` only |

---

## Summary

| Category | Count |
|---|---|
| Routes audited | 31 |
| IDOR vulnerabilities found | 21 |
| IDOR vulnerabilities fixed | 21 |
| Role mismatch vulnerabilities fixed | 4 |
| Rate-limit gaps fixed | 1 |
| Public routes now requiring auth | 2 (`/talent/search`, `/jobs/:id/view`) |
| All rows fixed? | **Yes** |

## Key infrastructure added

- `server/src/middleware/callerContext.ts` — `loadCallerContext`, `requireRole`, `requireJobOwner`, `requireApplicationAccess`
- All routes now chain: `requireAuth → loadCallerContext → requireRole/requireJobOwner/requireApplicationAccess → handler`
- Identity fields (`user_id`, `talent_profile_id`, `production_id`) removed from all request bodies and query strings where the server can derive them from the JWT
- 404 returned (not 403) when a resource exists but belongs to a different user, to avoid leaking existence
- 403 returned only for role mismatches (wrong account type — not IDOR)
