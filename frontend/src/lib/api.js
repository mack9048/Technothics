import sample from '../sample/data.json';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY = import.meta.env.VITE_API_KEY || '';
// In `npm run dev` the Vite proxy forwards /api to the local PHP server.
const ROOT = BASE || (import.meta.env.DEV ? '/api' : '');

/** True when no backend is configured: the UI runs on the bundled sample snapshot. */
export const DEMO = ROOT === '';

async function request(method, path, body) {
  const res = await fetch(ROOT + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(KEY ? { 'X-Api-Key': KEY } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function fromSample(path) {
  if (path.startsWith('/warranty/')) path = '/warranty/' + decodeURIComponent(path.slice(10)).trim().toUpperCase();
  if (path in sample) return structuredClone(sample[path]);
  const key = path.split('?')[0];
  if (key in sample) return structuredClone(sample[key]);
  if (key.startsWith('/warranty/')) throw new Error('Serial number not found');
  throw new Error('No sample data for ' + key);
}

export const api = {
  async get(path) {
    if (DEMO) return fromSample(path);
    return request('GET', path);
  },
  /** In demo mode writes are not sent anywhere; callers get { demo: true } and update local state. */
  async post(path, body = {}) {
    if (DEMO) return { demo: true };
    return request('POST', path, body);
  },
  async patch(path, body = {}) {
    if (DEMO) return { demo: true };
    return request('PATCH', path, body);
  },
};
