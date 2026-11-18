// Saves API responses into src/sample/data.json so the UI can run without a backend (demo mode).
// Usage: start the PHP API, then  API=http://127.0.0.1:8000/api npm run snapshot
import { writeFileSync } from 'node:fs';

const API = (process.env.API || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const paths = [
  '/dashboard', '/production', '/service', '/field', '/inventory', '/accounts', '/accounts/profitability', '/hr',
  '/tech/jobs', '/tech/jobs/SR-1044', '/tech/onsite/SR-1046',
  '/production?model=850VA Home', '/production?model=1100VA Home', '/production?model=2kVA Heavy', '/production?model=5kVA Heavy',
  '/field?period=week', '/field?period=month',
  '/warranty/INV-1K-2611-00482', '/warranty/INV-5K-2409-00031', '/warranty/INV-2K-2502-00088',
];
const out = {};
for (const p of paths) {
  const [path, query] = p.split('?');
  const url = API + path + (query ? '?' + query.split('=')[0] + '=' + encodeURIComponent(query.split('=')[1]) : '');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  out[p.replace(/%20/g, ' ')] = await res.json();
}
// The demo UI encodes the query, so store both spellings.
for (const k of Object.keys(out)) if (k.includes(' ')) out[k.replace(/ /g, '%20')] = out[k];
writeFileSync(new URL('../src/sample/data.json', import.meta.url), JSON.stringify(out));
console.log('Saved', Object.keys(out).length, 'responses');
