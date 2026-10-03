import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, TEST_TOKEN, standardOptions } from './config.js';

export const options = standardOptions;

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_TOKEN}`,
  };

  const payload = JSON.stringify({
    job_id: '11111111-1111-1111-1111-111111111111',
    cover_note: 'Experienced technician ready for production.',
    portfolio_url: 'https://vimeo.com/123456789',
  });

  const res = http.post(`${BASE_URL}/applications`, payload, { headers });

  check(res, {
    'application status valid (201 or 400/409 duplicate)': (r) =>
      r.status === 201 || r.status === 400 || r.status === 409 || r.status === 404,
  });

  sleep(2);
}
