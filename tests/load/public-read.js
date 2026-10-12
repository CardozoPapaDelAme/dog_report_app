import http from 'k6/http';
import { check, sleep } from 'k6';

// T9: deliberately small, read-only load profile for the managed Free project.
// Required: API_BASE_URL=https://<project>.supabase.co/functions/v1/api
const base = (__ENV.API_BASE_URL || '').replace(/\/$/, '');
if (!base) throw new Error('API_BASE_URL is required');

export const options = {
  vus: Number(__ENV.VUS || 2),
  duration: __ENV.DURATION || '60s',
  thresholds: { http_req_failed: ['rate<0.01'] },
};

export default function () {
  const endpoints = [
    '/health',
    '/public/clusters?zoom=12&min_longitude=-107.64&min_latitude=27.72&max_longitude=-107.62&max_latitude=27.74&limit=20',
    '/public/reports?limit=20',
  ];
  const response = http.get(`${base}${endpoints[__ITER % endpoints.length]}`);
  check(response, { 'lectura responde 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(1);
}
