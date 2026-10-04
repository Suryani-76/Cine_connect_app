# CineConnect — Legal & Regulatory Launch Checklist (DPDP & GDPR)

> **CRITICAL LEGAL NOTICE: PENDING COUNSEL VERIFICATION**  
> All privacy policies, terms of service, cookie notices, consent mechanisms, statutory section references, and grievance redressal texts implemented in CineConnect are **TECHNICAL IMPLEMENTATIONS AND DRAFTS ONLY**. Every statutory citation and regulatory claim in this repository is strictly **pending counsel verification** until a qualified attorney signs off.  
> Sections 5, 6, 9, 11, 12, and 13 of the Digital Personal Data Protection Act, 2023 (DPDP Act) are maintained solely as technical design references and benchmarks, not as legal statements of formal statutory compliance.

---

## 1. Statutory Reference Matrix (All Citations Pending Counsel Verification)

| Statutory Citation (Design Reference Only) | Regulatory Principle | Technical Feature Reference | Counsel Verification Status |
|---|---|---|---|
| **DPDP Act 2023 §5** | Notice prior to or at time of personal data collection | `/privacy` page + registration disclosures | `[ ] PENDING COUNSEL VERIFICATION` |
| **DPDP Act 2023 §6** | Valid affirmative consent requirements | Required checkboxes on `/register` + version tracking in `user_consents` | `[ ] PENDING COUNSEL VERIFICATION` |
| **DPDP Act 2023 §6(4)** | Right of Data Principal to withdraw consent | Profile data privacy settings + `DELETE /account` | `[ ] PENDING COUNSEL VERIFICATION` |
| **DPDP Act 2023 §9** | Processing of personal data of children | 18+ age confirmation checkbox at registration; child talent is **OUT OF SCOPE for v1** | `[ ] PENDING COUNSEL VERIFICATION` |
| **DPDP Act 2023 §11** | Right to access personal data & information | `GET /account/export` machine-readable JSON data export | `[ ] PENDING COUNSEL VERIFICATION` |
| **DPDP Act 2023 §12** | Right to correction and erasure of personal data | Inline profile editing + `DELETE /account` cascading purge | `[ ] PENDING COUNSEL VERIFICATION` |
| **DPDP Act 2023 §13** | Grievance redressal mechanism | `/contact` page with appointed Grievance Officer details & SLA | `[ ] PENDING COUNSEL VERIFICATION` |
| **IT Rules 2021 Rule 3** | Intermediary due diligence & grievance publication | Published on `/contact`, `/terms`, `/privacy` with email and address | `[ ] PENDING COUNSEL VERIFICATION` |
| **GDPR Art. 13/14** | Information to be provided where personal data collected | Detailed sub-processor disclosures on `/privacy` | `[ ] PENDING COUNSEL VERIFICATION` |
| **GDPR Art. 20** | Right to data portability | `GET /account/export` standardized JSON format | `[ ] PENDING COUNSEL VERIFICATION` |
| **GDPR Art. 17** | Right to erasure ('Right to be forgotten') | `DELETE /account` cascading DB and storage purge | `[ ] PENDING COUNSEL VERIFICATION` |

---

## 2. Items Requiring Legal Counsel Sign-Off

### A. Age Gate & Child Talent Policy (§9 DPDP Act)
- [ ] **18+ Age Gate**: CineConnect enforces a mandatory "I confirm that I am 18 years of age or older" checkbox at registration, validated on the server and permanently recorded in `user_consents.age_confirmed`.
- [ ] **Child Talent / Performers**: Child actors and under-18 creative performers require a verifiable parental/guardian consent workflow and identity verification mechanism designed with counsel.
- [ ] **Scope Limitation**: Onboarding of minor / child talent is **strictly out of scope for v1**.

### B. Consent Network Identifiers & Data Retention
- [ ] **Clickwrap Record**: The `user_consents` table stores `{ user_id, terms_version, privacy_version, age_confirmed, ip_address, user_agent, consented_at }`.
- [ ] **Evidentiary Retention**: IP address and browser user-agent are collected exclusively to establish proof of affirmative consent under DPDP §6.
- [ ] **Automated Anonymization Purge**: These network identifiers are retained for **180 days (6 months)**, after which an automated retention worker purges and nullifies the IP address and user-agent fields while preserving the non-identifying proof of consent and timestamps.

### C. Grievance Officer Formal Appointment (§13 DPDP Act & IT Rules 2021)
- [ ] Confirm official full legal name, designation, physical address, and dedicated grievance email address.
- [ ] Ensure operational protocol is in place to acknowledge grievances within 24 hours and resolve within 15–30 days as prescribed by law.
- [ ] Current draft placeholder:
  - **Officer**: Grievance Officer, CineConnect Media Private Limited
  - **Email**: `grievance@cineconnect.in`
  - **Address**: Film City Complex, Goregaon (East), Mumbai, Maharashtra 400065, India

### D. Two-Sided Marketplace Terms of Service (`/terms`)
- [ ] **Intermediary Status**: Safe harbor declaration under Section 79 of the Information Technology Act, 2000.
- [ ] **No Employment Relationship**: Confirmation that CineConnect is solely a technology platform connecting independent creative talent and production companies; CineConnect does not act as an employer, agent, or union representative.
- [ ] **Intellectual Property Rights**:
  - Creative reels, scripts, showreels, headshots, and project resumes remain 100% owned by the creator.
  - License granted to CineConnect is limited to hosting, displaying, and algorithmic match scoring within the marketplace.
- [ ] **Fee & Commission Structure**: Terms regarding platform subscriptions, talent fee payments, and non-circumvention terms (if applicable).
- [ ] **Governing Law & Dispute Resolution**: Arbitration and courts in Mumbai, Maharashtra, India.

### E. Privacy Notice & Single Email Sub-Processor (`/privacy`)
- [ ] **Data Fiduciary**: CineConnect Media Technologies Private Limited.
- [ ] **Sub-Processors Disclosed**:
  - **Supabase Inc.** (PostgreSQL Database, Authentication, and File Storage, hosted in AWS ap-south-1 Mumbai / global infrastructure).
  - **Fly.io Inc.** (Backend Node.js API hosting in Mumbai datacenter `bom`).
  - **Vercel Inc.** (Frontend React application CDN hosting and edge delivery).
  - **Resend Inc.** (Sole transactional email provider for OTP codes and notifications).
  - **Sentry** (Error tracking with PII scrubbing and IP address redaction).
- [ ] **Cross-Border Transfers**: Compliance with Indian government notifications on cross-border data flows under DPDP Act 2023.

---

## 3. Pre-Launch Verification Sign-Off Table

| Review Area | Assigned Counsel | Date Reviewed | Status |
|---|---|---|---|
| Indian IT Act / DPDP Act Statutory Citations | TBD | | `PENDING COUNSEL VERIFICATION` |
| 18+ Age Gate & Child Performer Policy | TBD | | `PENDING COUNSEL VERIFICATION` |
| Terms of Service (Marketplace & IP) | TBD | | `PENDING COUNSEL VERIFICATION` |
| Cookie & Privacy Policy (IP/UA retention) | TBD | | `PENDING COUNSEL VERIFICATION` |
| Grievance Officer Appointment & Protocol | TBD | | `PENDING COUNSEL VERIFICATION` |
