# CineConnect Email Deliverability, Preferences & Scheduler Architecture

## 1. Overview & Provider Architecture

CineConnect uses **Resend** as its core transactional and notification email provider. The system is designed around an asynchronous transactional outbox pattern to guarantee that transactional database writes and user notifications remain decoupled from external third-party API latency or intermittent outages.

### 1.1 Provider Interface

All email dispatches go through the thin `EmailProvider` interface defined in `server/src/services/email/emailProvider.ts`:

```typescript
export interface EmailMessage {
  to: string | string[]
  from?: string
  subject: string
  html: string
  text: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<SendEmailResult>
}
```

The concrete implementation `ResendEmailProvider` talks directly to the Resend REST API (`https://api.resend.com/emails`) using native HTTP fetch with zero heavy third-party SDK dependencies. For unit and integration tests, `MockEmailProvider` captures sent emails in memory and supports simulated failure triggers.

### 1.2 Environment Configuration

The following environment variables are validated at server boot via `scripts/validate-env.ts`:
- `RESEND_API_KEY`: API key starting with `re_`.
- `EMAIL_FROM`: Verified sender address (e.g. `CineConnect <noreply@cineconnect.app>`).
- `APP_URL`: Frontend web application URL used for action links and unsubscribe tokens (e.g. `https://cineconnect.app` or `http://localhost:5173`).

---

## 2. Database Schema

### 2.1 Notification Preferences (`public.notification_preferences`)

User email notification preferences are isolated in `public.notification_preferences`:

| Column | Type | Default | Description |
|---|---|---|---|
| `user_id` | `uuid` (PK) | — | References `public.users(id)` ON DELETE CASCADE |
| `new_application` | `boolean` | `true` | When someone applies to a production job |
| `status_change` | `boolean` | `true` | When candidate application status changes |
| `new_message` | `boolean` | `true` | Direct chat message notification |
| `job_closed` | `boolean` | `true` | Notice that an applied job has closed |
| `talent_alert_match` | `boolean` | `true` | Saved talent/job search alert matches |
| `digest_frequency` | `text` | `'daily'` | `'off'`, `'daily'`, or `'weekly'` |
| `unsubscribe_token` | `uuid` | `gen_random_uuid()` | Unique public token for one-click unsubscription |
| `created_at` | `timestamptz` | `now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | `now()` | Last preference change timestamp |

*Auto-provisioning:* A database trigger `trg_auto_notification_preferences` creates a default preferences row whenever a user is inserted into `public.users`.

### 2.2 Transactional Outbox (`public.email_outbox`)

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` | Unique outbox item ID |
| `user_id` | `uuid` | `null` | Optional recipient user foreign key |
| `recipient_email`| `text` | — | Target email address |
| `subject` | `text` | — | Email subject line |
| `template_name` | `text` | — | Template identifier |
| `payload` | `jsonb` | `'{}'` | Dynamic template parameters |
| `status` | `text` | `'pending'` | `'pending'`, `'sent'`, `'failed'`, `'dead'` |
| `attempts` | `int` | `0` | Number of dispatch attempts made |
| `max_attempts` | `int` | `5` | Maximum retry attempts before marking dead |
| `next_attempt_at`| `timestamptz`| `now()` | Earliest timestamp for next retry attempt |
| `last_error` | `text` | `null` | Error message from last failure |
| `sent_at` | `timestamptz`| `null` | Timestamp when successfully sent |
| `created_at` | `timestamptz`| `now()` | Enqueue timestamp |
| `updated_at` | `timestamptz`| `now()` | Last state update timestamp |

---

## 3. Worker Engine & Safety Controls

The email worker (`server/src/workers/emailWorker.ts`) operates autonomously with strict safety guarantees:

### 3.1 Concurrency & Atomic Claiming (`FOR UPDATE SKIP LOCKED`)
The worker claims pending or failed items using Postgres `FOR UPDATE SKIP LOCKED` via the stored procedure `claim_email_outbox_batch(batch_size)`:
```sql
with claimed as (
  select id
  from public.email_outbox
  where status in ('pending', 'failed')
    and attempts < 5
    and (next_attempt_at is null or next_attempt_at <= now())
  order by next_attempt_at asc, created_at asc
  limit batch_size
  for update skip locked
)
update public.email_outbox o
set attempts = o.attempts + 1,
    updated_at = now()
from claimed
where o.id = claimed.id
returning o.*;
```
This guarantees that multiple worker instances running concurrently across Fly.io machines never double-process or collide on the same email.

### 3.2 Exponential Backoff & Dead Letter State
When Resend encounters a transient failure or rate limit:
- Attempt 1 failure: retry in 1 minute (`+60s`)
- Attempt 2 failure: retry in 5 minutes (`+300s`)
- Attempt 3 failure: retry in 30 minutes (`+1800s`)
- Attempt 4 failure: retry in 2 hours (`+7200s`)
- Attempt 5 failure: the row is transitioned to `status = 'dead'` with `last_error` recorded. Dead rows are permanently halted from automatic retries and can be audited by administrators.

### 3.3 Suspended User Suppression
Before sending, the worker inspects the recipient user's `users.suspended_at` status. If the user is currently suspended by an administrator, the email is immediately marked `status = 'dead'` with error `'Recipient account is suspended'`, ensuring suspended bad actors never receive platform broadcasts.

### 3.4 Preference Filtering
The worker evaluates the user's `notification_preferences`. If the recipient has toggled off the specific notification type or disabled digests, the item is resolved as `status = 'sent'` with notice `'Skipped: disabled by user preference'`, avoiding unnecessary provider charges and respecting user privacy.

### 3.5 Conversation Throttling (30-Minute Window)
For `new_message` notifications, the worker prevents inbox flooding. If a message notification was already successfully dispatched for the same conversation thread within the past 30 minutes, subsequent emails in that window are coalesced and marked `status = 'sent'` with notice `'Throttled: 30-minute conversation rate limit'`.

---

## 4. Templates & Design System

Emails are styled using CineConnect brand colors:
- **Deep Navy**: `#0B2545` (Header background, primary CTA button, headings)
- **Warm Gold**: `#E0A96D` (Accent bars, highlights, button borders)
- **Neutral Light**: `#F4F6F9` (Email backdrop)
- **Card Background**: `#FFFFFF` (High-contrast content container)

Every email template produces both **HTML** and **Plain Text** versions:
1. `new_application`: Alerts production teams when a candidate applies, quoting the cover note and linking directly to candidate review.
2. `status_change`: Updates candidates on application progress (`shortlisted`, `interview`, `hired`, `rejected`). If an interview date is set, an alert card displays the scheduled date and time prominently.
3. `new_message`: Alerts users to incoming direct chat messages with preview text.
4. `job_closed`: Informs candidates when a job listing has officially closed.
5. `talent_alert_match`: Notifies talent when a newly posted job matches their saved search alerts.
6. `digest`: Summarizes daily or weekly unread messages, new applications, and opportunities.

### One-Click Unsubscribe (Zero Login Required)
Every email includes:
- Link to user settings: `${APP_URL}/settings?tab=notifications`
- Token-based unsubscribe URL: `${APP_URL}/unsubscribe/${unsubscribe_token}`
Clicking the unsubscribe link instantly disables notifications without requiring the user to authenticate or remember their password.

---

## 5. Fly.io Scheduler & Process Architecture

### 5.1 Process Groups vs Scheduled Machines

CineConnect divides server operations into continuous services and periodic cron tasks on Fly.io:

```toml
[processes]
  app = "node dist/index.js"
  email_worker = "node dist/workers/emailWorker.js"
  recompute_worker = "node dist/workers/recomputeWorker.js"

[[services]]
  processes = ["app"]
  protocol = "tcp"
  internal_port = 3000
```

#### Why Separate Process Groups for Continuous Workers?
1. **Isolated Fault Domains**: If an outbox worker encounters an unexpected unhandled exception or memory leak, the Express web API server remains unaffected and responsive.
2. **Dedicated Scaling**: The API server can scale horizontally according to HTTP traffic load (`auto_stop_machines = true`, concurrency limits), while the background email worker runs a single steady instance with no open HTTP ports.
3. **No Open Ports**: The `email_worker` and `recompute_worker` processes do not bind to port 3000 and do not expose external network endpoints.

#### Scheduled Machines for Periodic Tasks
For infrequent or batch jobs, Fly.io scheduled ephemeral machines (or Fly cron triggers) run on a timer:
- **Daily / Weekly Digest (`server/src/workers/digestWorker.ts`)**:
  - Daily: `fly machine run . --schedule="0 8 * * *" node dist/workers/digestWorker.js`
  - Weekly: `fly machine run . --schedule="0 8 * * 1" node dist/workers/digestWorker.js --weekly`
  - Scans user preferences, compiles activity summaries over the window, and enqueues digest rows into `email_outbox`.
- **Retention Purge (`server/src/workers/retentionWorker.ts`)**:
  - Daily: `fly machine run . --schedule="0 2 * * *" node dist/workers/retentionWorker.js`
  - Executes `runRetentionPurge()` to permanently delete read notifications older than 90 days and outbox records older than 30 days.

---

## 6. API Endpoints

- `GET /settings/notifications`: Authenticated endpoint returning user notification preferences.
- `PUT /settings/notifications`: Authenticated endpoint updating notification flags and digest frequency.
- `GET /unsubscribe/:token`: Public endpoint verifying an unsubscribe token and returning notification status.
- `POST /unsubscribe/:token`: Public endpoint executing one-click unsubscribe without authentication.
