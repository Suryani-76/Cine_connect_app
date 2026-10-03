import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, standardOptions } from './config.js';

export const options = standardOptions;

const ROLES = ['Director of Photography', 'Editor', 'Sound Designer', 'Colorist', 'Actor'];
const CITIES = ['Mumbai', 'Hyderabad', 'Chennai', 'Bengaluru'];

export default function () {
  const role = ROLES[Math.floor(Math.random() * ROLES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];

  // Test 1: Fetch all published jobs
  const resAll = http.get(`${BASE_URL}/jobs?status=published&page=1&limit=20`);
  check(resAll, {
    'all jobs status is 200': (r) => r.status === 200,
    'all jobs returned json array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.jobs) || Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.5);

  // Test 2: Filtered query (exercises composite index)
  const resFiltered = http.get(
    `${BASE_URL}/jobs?status=published&role=${encodeURIComponent(role)}&city=${encodeURIComponent(city)}`
  );
  check(resFiltered, {
    'filtered jobs status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
