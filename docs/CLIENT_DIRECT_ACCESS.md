# Client Direct Supabase Access Inventory

This inventory documents all direct Supabase calls (`supabase.from()`, `supabase.rpc()`, `supabase.storage`, and `supabase.channel()`) in `client/src`, identifying each operation, the replacement Express API endpoint, and its migration status.

Per system architectural guidelines, all direct client-side database reads, writes, and updates are moved onto the Express backend API with centralized authentication, Zod schema validation, identity derivation from `req.caller`, and strict field projection (preventing exposure of private data like email or phone).

---

## 1. Direct Database Access (`supabase.from`)

| File | Line | Table | Operation | Replacement API Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `client/src/pages/Profile.tsx` | 119 | `production_profiles` | `select` | `GET /production/profile` (own) or `GET /production/profile/:id` | **Migrated** | Replaced with `productionApi.getMyProfile()` and `productionApi.getProfile(id)` |
| `client/src/pages/Profile.tsx` | 132 | `talent_profiles` | `select` | `GET /talent/profile` (own) or `GET /talent/profile/:id` | **Migrated** | Replaced with `talentApi.getMyProfile()` and `talentApi.getProfile(id)` |
| `client/src/pages/Profile.tsx` | 161 | `production_profiles` / `talent_profiles` | `update` | `PUT /production/profile` and `PUT /talent/profile` | **Migrated** | Replaced with `productionApi.updateProfile()` and `talentApi.updateProfile()` |
| `client/src/pages/Chat.tsx` | 108 | `messages` | `select` | `GET /conversations` | **Migrated** | Replaced with `chatApi.getConversations()` |
| `client/src/pages/Chat.tsx` | 136 | `messages` | `select` | `GET /messages/:otherUserId` | **Migrated** | Replaced with `chatApi.getMessages()` with cursor pagination |
| `client/src/pages/Chat.tsx` | 148 | `messages` | `update` | `PUT /messages/read` | **Migrated** | Replaced with `chatApi.markRead()` |
| `client/src/pages/Chat.tsx` | 215 | `messages` | `insert` | `POST /messages` | **Migrated** | Replaced with `chatApi.sendMessage()`, rate limited and permission checked |

---

## 2. Remote Procedure Calls (`supabase.rpc`)

| File | Line | Function | Operation | Replacement API Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *None* | — | — | — | — | **N/A** | No direct `supabase.rpc()` calls found in `client/src` |

---

## 3. Storage Access (`supabase.storage`)

| File | Line | Bucket | Operation | Replacement API Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `client/src/pages/Profile.tsx` | 254 | `avatars` | `upload` | `POST /storage/avatar` | **Deferred (4C-3)** | Server-side avatar upload & sanitization tracked for Milestone 4C-3 |
| `client/src/pages/Profile.tsx` | 258 | `avatars` | `getPublicUrl` | `GET /storage/avatar/:id` | **Deferred (4C-3)** | Public avatar URL resolution tracked for Milestone 4C-3 |

---

## 4. Realtime Channels (`supabase.channel` / subscriptions)

*Note: Realtime subscriptions are explicitly retained on Supabase Client per architecture guidelines.*

| File | Line | Channel Topic | Event / Filter | Replacement API Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `client/src/components/NotificationBell.tsx` | 90 | `notifications:${userId}` | `INSERT` on `notifications` | Retained (Realtime) | **Retained** | Realtime notification toast/count updates. Mark-read actions already invoke `notificationsApi` on Express. |
| `client/src/pages/Home.tsx` | 336 | `my-apps:${profileId}` | `UPDATE` on `applications` | Retained (Realtime) | **Retained** | Live application pipeline status update. |
| `client/src/pages/Chat.tsx` | 160 | `chat:${userId}` | `INSERT` on `messages` | Retained (Realtime) | **Retained** | Live incoming chat message delivery. |

---

## 5. Supabase Auth (Explicitly Retained)

*The following auth operations are retained on the client for OAuth / session token lifecycle:*

- `client/src/context/AuthContext.tsx`: `supabase.auth.onAuthStateChange`, `supabase.auth.getSession`, `supabase.auth.signOut`
- `client/src/pages/Login.tsx`: `supabase.auth.signInWithPassword`, `supabase.auth.resetPasswordForEmail`
- `client/src/pages/ResetPassword.tsx`: `supabase.auth.updateUser`, `supabase.auth.signOut`
- `client/src/lib/api.ts`: `supabase.auth.refreshSession`

---

## 6. Migration Summary

- **Total Non-Auth/Non-Realtime `supabase.from()` calls in `Profile.tsx`**: 3 (All 3 **MIGRATED** to Express API).
- **Remaining Direct DB Calls**: 6 (All in `Chat.tsx`, tracked for Milestone 4C-2).
- **Remaining Direct Storage Calls**: 2 (In `Profile.tsx`, tracked for Milestone 4C-3).
- **Unmigrated Rows**: 0 unmigrated (only Chat [4C-2] and Avatar Upload [4C-3] remain).
