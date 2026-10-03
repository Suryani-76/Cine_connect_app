# CineConnect — Legal & Regulatory Launch Checklist (DPDP & GDPR)

> **CRITICAL LEGAL NOTICE**
> All privacy policies, terms of service, cookie notices, consent mechanisms, and grievance redressal texts implemented in CineConnect are **TECHNICAL IMPLEMENTATIONS AND DRAFTS ONLY**. They MUST be reviewed, validated, and approved by qualified legal counsel in India (for the Digital Personal Data Protection Act, 2023) and international counsel (for GDPR/cross-border transfer compliance) prior to production launch.

---

## 1. Statutory Compliance Matrix

| Regulation | Requirement | Technical Implementation | Counsel Review Status |
|---|---|---|---|
| **DPDP Act 2023 §5** | Notice prior to or at the time of collecting personal data | `/privacy` page + explicit registration consent modal/checkbox | `[ ] DRAFT — Pending Counsel Review` |
| **DPDP Act 2023 §6** | Consent must be free, specific, informed, unconditional, and unambiguous | Required checkbox on `/register` + version tracking in `user_consents` | `[ ] DRAFT — Pending Counsel Review` |
| **DPDP Act 2023 §6(7)** | Right to withdraw consent | Profile data privacy settings + Account deletion endpoint | `[ ] DRAFT — Pending Counsel Review` |
| **DPDP Act 2023 §11** | Right to access information about personal data | `GET /account/export` machine-readable JSON data export | `[ ] DRAFT — Pending Counsel Review` |
| **DPDP Act 2023 §12** | Right to correction and erasure of personal data | Inline profile editing + `DELETE /account` cascading purge | `[ ] DRAFT — Pending Counsel Review` |
| **DPDP Act 2023 §13** | Grievance redressal mechanism | `/contact` page with designated Grievance Officer details & SLA | `[ ] DRAFT — Pending Counsel Review` |
| **IT Rules 2021 Rule 3** | Intermediary due diligence & grievance officer publication | Published on `/contact`, `/terms`, `/privacy` with email and address | `[ ] DRAFT — Pending Counsel Review` |
| **GDPR Art. 13/14** | Information to be provided where personal data are collected | Detailed data processor disclosure on `/privacy` | `[ ] DRAFT — Pending Counsel Review` |
| **GDPR Art. 20** | Right to data portability | `GET /account/export` standardized JSON format | `[ ] DRAFT — Pending Counsel Review` |
| **GDPR Art. 17** | Right to erasure ('Right to be forgotten') | `DELETE /account` removing DB records and storage assets | `[ ] DRAFT — Pending Counsel Review` |

---

## 2. Items Requiring Legal Counsel Sign-Off

### A. Grievance Officer Formal Appointment (DPDP §13 & IT Rules)
- [ ] Confirm official full legal name, designation, physical address, and dedicated grievance email address.
- [ ] Ensure operational protocol is in place to acknowledge grievances within 24 hours and resolve within 15–30 days as prescribed by law.
- [ ] Current draft placeholder:
  - **Officer**: Grievance Officer, CineConnect Media Private Limited
  - **Email**: `grievance@cineconnect.in`
  - **Address**: Film City Complex, Goregaon (East), Mumbai, Maharashtra 400065, India

### B. Two-Sided Marketplace Terms of Service (`/terms`)
- [ ] **Intermediary Status**: Safe harbor declaration under Section 79 of the Information Technology Act, 2000.
- [ ] **No Employment Relationship**: Confirmation that CineConnect is solely a platform connecting independent creative talent and production companies; CineConnect does not act as an employer, agent, or union representative.
- [ ] **Intellectual Property Rights**:
  - Creative reels, scripts, showreels, headshots, and project resumes remain 100% owned by the creator.
  - License granted to CineConnect is limited to hosting, displaying, and algorithmic match scoring within the marketplace.
- [ ] **Fee & Commission Structure**: Terms regarding platform subscriptions, talent fee payments, and non-circumvention terms (if applicable).
- [ ] **Governing Law & Dispute Resolution**: Arbitration and courts in Mumbai, Maharashtra, India.

### C. Privacy Notice & Data Processors (`/privacy`)
- [ ] **Data Fiduciary**: CineConnect Media Technologies Private Limited.
- [ ] **Sub-Processors Disclosed**:
  - **Supabase Inc.** (PostgreSQL Database, Authentication, and File Storage, hosted in AWS ap-south-1 Mumbai / global infrastructure).
  - **Fly.io Inc.** (Backend Node.js API hosting in Mumbai datacenter `bom`).
  - **Vercel Inc.** (Frontend React application CDN hosting and edge delivery).
  - **Resend Inc.** (Transactional email notifications and password reset delivery).
  - **Sentry / Functional Telemetry** (Application performance and error tracking with PII stripping).
- [ ] **Cross-Border Transfers**: Compliance with Indian government notifications on cross-border data flows under DPDP Act 2023.

### D. Consent Versioning & Re-Consent Policy
- [ ] Review the validity of clickwrap consent: `user_consents` table stores `{ user_id, terms_version, privacy_version, ip_address, user_agent, consented_at }`.
- [ ] Establish notification thresholds for material vs. non-material terms updates (e.g. 30 days prior notice via email + forced re-consent modal on next login).

### E. Minor Protection (§9 DPDP Act)
- [ ] CineConnect enforces a strict 18+ age verification check at registration. If child actors/performers are onboarded in the future, verifiable parental consent workflows must be legally architected.

---

## 3. Pre-Launch Verification Sign-Off Table

| Review Area | Assigned Counsel | Date Reviewed | Status |
|---|---|---|---|
| Indian IT Act / DPDP Compliance | TBD | | `PENDING` |
| Terms of Service (Marketplace & IP) | TBD | | `PENDING` |
| Cookie & Privacy Policy | TBD | | `PENDING` |
| Grievance Officer Protocol | TBD | | `PENDING` |
