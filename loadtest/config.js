/**
 * k6 Load Test Configuration & Safety Guard
 * ──────────────────────────────────────────
 * STRICT RULE: Refuses production URLs to prevent DDoS or test data pollution.
 */

export const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

// Safety Guard: Abort if pointed at production
if (
  BASE_URL.includes('cineconnect.in') ||
  BASE_URL.includes('api.cineconnect.in') ||
  __ENV.APP_ENV === 'production'
) {
  throw new Error(
    `[CRITICAL SAFETY VIOLATION] k6 load tests are STRICTLY PROHIBITED against production (${BASE_URL}). Point to staging or localhost only!`
  );
}

export const TEST_TOKEN = __ENV.AUTH_TOKEN || 'test-mock-jwt-token';

export const standardOptions = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 VUs
    { duration: '1m', target: 100 },   // Ramp-up to 100 VUs
    { duration: '2m', target: 100 },   // Sustain at 100 VUs
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // Target: p95 < 400 ms
    http_req_duration: ['p(95)<400'],
    // Target: error rate < 1%
    http_req_failed: ['rate<0.01'],
  },
};
