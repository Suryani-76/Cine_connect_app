import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, TEST_TOKEN, standardOptions } from './config.js';

export const options = standardOptions;

export default function () {
  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
  };

  const res = http.get(`${BASE_URL}/notifications?limit=15`, { headers });

  check(res, {
    'notifications poll status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1.5);
}
