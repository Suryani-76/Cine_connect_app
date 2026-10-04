# CineConnect Email Deliverability & DNS Architecture

> **NOTICE:** DRAFT — review by infrastructure and security lead before launch.

This document outlines the exact DNS records, email authentication standards (SPF, DKIM, DMARC), Supabase custom SMTP integration, and responsive branded email templates required to achieve 99%+ deliverability into Gmail, Outlook, and Apple Mail inboxes.

---

## 1. Domain Configuration & Architecture

- **Primary Web Domain:** `cineconnect.in`
- **Mail Sending Subdomain:** `mail.cineconnect.in` (recommended to isolate transactional reputation from corporate email)
- **From Address:** `CineConnect <noreply@cineconnect.in>` or `CineConnect <noreply@mail.cineconnect.in>`
- **Grievance / Support Inbound:** `support@cineconnect.in` / `grievance@cineconnect.in`
- **Sending Infrastructure:** Resend

---

## 2. Exact DNS Records

Add the following DNS records in your domain registrar (e.g. Cloudflare / Route 53):

| Type | Name / Host | Target / Value | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **TXT** | `cineconnect.in` | `v=spf1 include:resend.com ~all` | 300 | SPF Authorisation |
| **CNAME** | `resend._domainkey.cineconnect.in` | `dkim.resend.com.` | 300 | Primary DKIM Key |
| **MX** | `mail.cineconnect.in` | `10 feedback.resend.com` | 300 | Bounce & Inbound handling |
| **TXT** | `mail.cineconnect.in` | `v=spf1 include:resend.com ~all` | 300 | Subdomain SPF |
| **TXT** | `_dmarc.cineconnect.in` | *(See Staged Policy below)* | 300 | DMARC Policy |

---

## 3. Staged DMARC Rollout Plan

To prevent legitimate transactional emails from being dropped due to misconfiguration, rollout DMARC in three staged phases:

### Phase 1: Monitoring Mode (Day 1 – Day 14)
Monitor traffic, identify all sending services (Supabase, Resend, internal cron jobs), and collect aggregate XML reports.
```txt
v=DMARC1; p=none; rua=mailto:dmarc-reports@cineconnect.in; ruf=mailto:dmarc-forensics@cineconnect.in; sp=none; aspf=r; adkim=r; pct=100
```

### Phase 2: Quarantine Mode (Day 15 – Day 30)
Instruct ISPs (Gmail/Outlook) to route unauthenticated emails to the Spam/Quarantine folder. Ramp up percentage gradually from 25% to 100%.
```txt
v=DMARC1; p=quarantine; pct=50; rua=mailto:dmarc-reports@cineconnect.in; ruf=mailto:dmarc-forensics@cineconnect.in; sp=quarantine; aspf=s; adkim=s
```
*(After 7 days without false positives, bump to `pct=100`)*.

### Phase 3: Strict Rejection (Day 31+)
Instruct receiving mail transfer agents (MTAs) to completely reject spoofed or unauthenticated emails pretending to originate from `@cineconnect.in`.
```txt
v=DMARC1; p=reject; pct=100; rua=mailto:dmarc-reports@cineconnect.in; ruf=mailto:dmarc-forensics@cineconnect.in; sp=reject; aspf=s; adkim=s
```

---

## 4. Supabase Custom SMTP Configuration

By default, Supabase sends OTP and verification emails through shared infrastructure with strict rate limits (3 emails/hour). For production:

1. Open **Supabase Dashboard** -> Project `cineconnect` -> **Authentication** -> **SMTP Settings**.
2. Toggle **Enable Custom SMTP** to **ON**.
3. Fill in the following credentials:
   - **Sender Email:** `noreply@cineconnect.in`
   - **Sender Name:** `CineConnect Platform`
   - **Host:** `smtp.resend.com`
   - **Port:** `587` (TLS) or `465` (SSL)
   - **Username:** `resend`
   - **Password:** `re_live_xxxxxxxxxxxxxxxxxxxx` *(Your Resend Production API Key)*
4. Under **Authentication** -> **URL Configuration**:
   - **Site URL:** `https://cineconnect.in`
   - **Redirect URLs:**
     - `https://cineconnect.in/verify`
     - `https://cineconnect.in/reset-password`
     - `http://localhost:5173/**` *(Staging/Dev only)*

---

## 5. Branded HTML Email Templates

### 5.1 Verification / OTP Email Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your CineConnect Verification Code</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; }
    .header { background-color: #0B2545; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header h1 span { color: #E0A96D; }
    .content { padding: 36px 32px; color: #1E293B; line-height: 1.6; }
    .otp-box { margin: 28px 0; padding: 18px; background-color: #F1F5F9; border-radius: 8px; text-align: center; border: 1px dashed #CBD5E1; }
    .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0B2545; margin: 0; font-family: monospace; }
    .expiry { font-size: 13px; color: #64748B; margin-top: 8px; }
    .footer { padding: 24px 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; text-align: center; }
    .footer a { color: #0B2545; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cine<span>Connect</span></h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0; font-size: 20px; color: #0F172A;">Verify your email address</h2>
      <p>Welcome to CineConnect! Please enter the 6-digit verification code below to verify your account and join India's premier film-industry marketplace.</p>
      
      <div class="otp-box">
        <p class="otp-code">{{ .Token }}</p>
        <p class="expiry">This code will expire in 10 minutes.</p>
      </div>

      <p style="font-size: 14px; color: #64748B;">If you did not request this account registration, please safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© 2026 CineConnect Media Technologies Pvt. Ltd., Mumbai, India.</p>
      <p>Processed under India's DPDP Act 2023. <a href="https://cineconnect.in/privacy">Privacy Policy</a> • <a href="https://cineconnect.in/contact">Grievance Officer</a></p>
    </div>
  </div>
</body>
</html>
```

### 5.2 Password Reset Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your CineConnect Password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; }
    .header { background-color: #0B2545; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700; }
    .header h1 span { color: #E0A96D; }
    .content { padding: 36px 32px; color: #1E293B; line-height: 1.6; }
    .btn { display: inline-block; padding: 14px 28px; background-color: #0B2545; color: #FFFFFF !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px 0; }
    .footer { padding: 24px 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cine<span>Connect</span></h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0; font-size: 20px; color: #0F172A;">Reset your password</h2>
      <p>We received a request to reset your password for your CineConnect account. Click the button below to choose a new password.</p>
      
      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="btn">Reset Password</a>
      </div>

      <p style="font-size: 13px; color: #64748B;">This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© 2026 CineConnect Media Technologies Pvt. Ltd., Mumbai, India.</p>
    </div>
  </div>
</body>
</html>
```

---

## 6. Pre-Launch Deliverability Checklist

- [ ] **Mail-Tester Validation:** Send a test email from Supabase/Resend to `mail-tester.com` -> Score must be **>= 9.5 / 10**.
- [ ] **SPF Pass Check:** Header `Received-SPF: pass (google.com: domain of noreply@cineconnect.in designates ...)`
- [ ] **DKIM Alignment:** Header `dkim=pass header.i=@cineconnect.in`
- [ ] **DMARC Alignment:** Header `dmarc=pass (p=NONE/QUARANTINE sp=NONE/QUARANTINE dis=NONE)`
- [ ] **Google Postmaster Tools:** Domain `cineconnect.in` added and verified via DNS TXT token to track spam rates (< 0.10% required).
- [ ] **Microsoft SNDS / JMRP:** IP ranges registered with Microsoft SmartNetwork Data Services.
- [ ] **Inbox Placement Test:** Verify arrival into Google Workspace / Gmail **Primary Inbox** (not Promotions / Spam), and Outlook.com Inbox.
