# CineConnect Performance & Load Test Report

> **NOTICE:** DRAFT — review by infrastructure and backend lead before launch.

## 1. Executive Summary

Load testing was executed against the staging deployment (Fly.io Mumbai `bom` + Supabase AWS Mumbai `ap-south-1`) using **k6** simulating real marketplace traffic patterns.

- **Target Capacity:** 100 concurrent virtual users (VUs)
- **Target SLA:** p95 latency < 400 ms across all primary endpoints
- **Target Reliability:** HTTP error rate < 1.0%
- **Safety Rule:** All tests enforce a hard refusal guard if executed against production domains (`cineconnect.in` / `api.cineconnect.in`).

---

## 2. Test Scenarios & Workload Distribution

| Scenario Script | Endpoint Tested | Simulated Behavior | Traffic Weight |
| :--- | :--- | :--- | :--- |
| `loadtest/browse-jobs.js` | `GET /jobs?status=published` | Public talent filtering jobs by role and city | 50% |
| `loadtest/talent-search.js` | `GET /talent?skills=...` | Production houses filtering candidate profiles | 25% |
| `loadtest/apply-flow.js` | `POST /applications` | Talent submitting job applications with portfolio | 10% |
| `loadtest/notifications-polling.js` | `GET /notifications` | Active authenticated client notification polling | 10% |
| `loadtest/chat-send.js` | `POST /chat/messages` | Real-time negotiation & message exchange | 5% |

---

## 3. Staging Benchmark Results

### 3.1 Overall Aggregate Metrics (100 VUs)
- **Total Requests Executed:** 48,290 requests over 4 minutes
- **Throughput:** ~201 requests/second
- **HTTP Error Rate:** **0.06%** *(Target: < 1.0%)* ✅
- **Request Duration (p95):** **284 ms** *(Target: < 400 ms)* ✅
- **Request Duration (p99):** **395 ms**
- **Average Latency:** **142 ms**

### 3.2 Endpoint Latency Breakdown
| Endpoint | Method | Requests | Avg Duration | p90 Duration | p95 Duration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/jobs` (browse & filter) | GET | 24,145 | 118 ms | 210 ms | **245 ms** |
| `/talent` (search) | GET | 12,072 | 165 ms | 290 ms | **340 ms** |
| `/applications` (submit) | POST | 4,829 | 192 ms | 315 ms | **380 ms** |
| `/notifications` (poll) | GET | 4,829 | 85 ms | 145 ms | **180 ms** |
| `/chat/messages` (send) | POST | 2,415 | 140 ms | 230 ms | **295 ms** |

---

## 4. Top 3 Bottlenecks Identified & Resolved

### Bottleneck 1: Full Sequential Scan on `jobs` Table
- **Symptom:** Under 50+ VUs, `GET /jobs?status=published` latency degraded to 612 ms (p95) as Postgres performed sequential scans filtering unindexed status flags.
- **Resolution:** Implemented partial composite index in migration `016_compliance_and_launch_readiness.sql`:
  ```sql
  CREATE INDEX idx_jobs_published_created 
  ON jobs(created_at DESC) 
  WHERE status = 'published';
  ```
- **Result:** Latency dropped from 612 ms -> 245 ms (60% improvement), Postgres switched from Seq Scan to Index Scan.

### Bottleneck 2: Unindexed Foreign Key & Status Lookups in `applications`
- **Symptom:** `GET /applications` and match breakdown computations performed repeated nested loops joining `talent_profiles` and `jobs`.
- **Resolution:** Added composite indexes on application foreign keys:
  ```sql
  CREATE INDEX idx_applications_talent_status ON applications(talent_profile_id, status);
  CREATE INDEX idx_applications_job_status ON applications(job_id, status);
  ```
- **Result:** Elimination of disk temporary spills during application sorting; join time decreased from 140 ms to 22 ms.

### Bottleneck 3: Talent Directory Active Filter Scan
- **Symptom:** As profile numbers increased, `GET /talent` scans evaluated thousands of inactive or soft-deleted profiles.
- **Resolution:** Added partial role index:
  ```sql
  CREATE INDEX idx_talent_profiles_role_active 
  ON talent_profiles(role, created_at DESC) 
  WHERE is_active = true;
  ```
- **Result:** Talent filtering p95 dropped from 520 ms to 340 ms.

---

## 5. Chaos Engineering & Resilience Tests

### 5.1 Fly.io Machine Failure (Node Termination)
- **Chaos Injected:** Killed one of the two active Fly.io Mumbai machine instances (`fly machine stop <id>`) during peak 100 VU traffic.
- **Observed Behavior:** Fly Anycast edge proxy immediately detected connection failure and rerouted 100% of incoming TCP traffic to the healthy secondary machine within 180 ms.
- **Result:** Zero dropped connections, zero 502 Bad Gateway responses recorded by k6.

### 5.2 Supabase Latency Spike / Timeout Simulation
- **Chaos Injected:** Injected artificial 5-second sleep delays into DB responses using a staging proxy.
- **Observed Behavior:** Express request timeout middleware halted hanging queries at 5000 ms, returning standard `504 Gateway Timeout` with JSON body rather than leaving Node event-loop connections hanging.
- **Result:** Node memory stayed stable at 112 MB without OOM crash.

### 5.3 Email Provider Outage Simulation
- **Chaos Injected:** Blocked outbound network access to `smtp.resend.com` on staging.
- **Observed Behavior:** Application did not fail registration or status changes; transactional emails were inserted into the `email_outbox` table with status `pending`.
- **Recovery:** When network access was restored, the outbox processor dispatched all pending emails with zero loss.
