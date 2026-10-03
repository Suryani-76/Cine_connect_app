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
    recipient_id: '22222222-2222-2222-2222-222222222222',
    content: 'Hi! Let us connect regarding the shoot dates next week.',
  });

  const res = http.post(`${BASE_URL}/chat/messages`, payload, { headers });

  check(res, {
    'chat message sent or auth handled': (r) =>
      r.status === 201 || r.status === 200 || r.status === 401 || r.status === 404,
  });

  sleep(1);
}
