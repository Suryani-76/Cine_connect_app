/**
 * client/src/lib/analytics.ts
 * ────────────────────────────
 * Privacy-friendly, consent-aware product analytics.
 * Fully compliant with DPDP Act 2023 & GDPR:
 * Respects cookie choices and only fires tracking events when
 * non-essential / analytics consent has been explicitly granted.
 */

export type AnalyticsEvent =
  | 'signup_started'
  | 'signup_completed'
  | 'profile_completed'
  | 'job_published'
  | 'application_submitted'
  | 'hired';

export interface EventProperties {
  role?: string;
  job_id?: string;
  department?: string;
  application_id?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Checks whether user has consented to analytics cookies/tracking.
 */
export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem('cc_cookie_consent');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed.analytics);
  } catch {
    return false;
  }
}

/**
 * Tracks a privacy-preserving product analytics event.
 */
export function trackEvent(event: AnalyticsEvent, props?: EventProperties): void {
  const isEnabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';

  // If analytics flag is disabled or consent not provided, drop event
  if (!isEnabled || !hasAnalyticsConsent()) {
    if (import.meta.env.DEV) {
      console.log(`[Analytics: Gated/Skipped] ${event}`, props);
    }
    return;
  }

  try {
    // 1. If Plausible is available on window
    const win = window as unknown as { plausible?: (name: string, opts?: { props?: EventProperties }) => void };
    if (typeof win.plausible === 'function') {
      win.plausible(event, { props });
      return;
    }

    // 2. Custom privacy endpoint beacon
    const apiUrl = import.meta.env.VITE_API_URL || '';
    if (navigator.sendBeacon) {
      const payload = JSON.stringify({
        event,
        properties: props,
        timestamp: new Date().toISOString(),
      });
      navigator.sendBeacon(`${apiUrl}/analytics/events`, payload);
    }
  } catch (err) {
    // Silent fail to never disrupt user experience
    if (import.meta.env.DEV) {
      console.error('[Analytics Error]', err);
    }
  }
}

// Convenience helpers
export const analytics = {
  signupStarted: (source = 'web') => trackEvent('signup_started', { source }),
  signupCompleted: (role: string) => trackEvent('signup_completed', { role }),
  profileCompleted: (role: string) => trackEvent('profile_completed', { role }),
  jobPublished: (jobId: string, department: string) => trackEvent('job_published', { job_id: jobId, department }),
  applicationSubmitted: (jobId: string) => trackEvent('application_submitted', { job_id: jobId }),
  hired: (applicationId: string) => trackEvent('hired', { application_id: applicationId }),
};
