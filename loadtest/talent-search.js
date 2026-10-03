import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, standardOptions } from './config.js';

export const options = standardOptions;

const SKILLS = ['DaVinci Resolve', 'Arri Alexa', 'Pro Tools', 'Steadicam', 'Color Grading'];

export default function () {
  const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];

  const res = http.get(
    `${BASE_URL}/talent?skills=${encodeURIComponent(skill)}&min_experience=2&limit=20`
  );

  check(res, {
    'talent search status is 200': (r) => r.status === 200,
    'response under 400ms': (r) => r.timings.duration < 400,
  });

  sleep(1);
}
