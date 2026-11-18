# Technothics — office web app + technician app

React front end (Vite, deploys to Vercel) and a PHP 8 JSON API (runs on any PHP host: cPanel/Apache, Nginx + PHP-FPM, a VPS).

```
frontend/   React 18 + React Router · Vite · vercel.json
backend/    PHP 8.1+ API · no framework, no Composer needed · MySQL (prod) or SQLite (dev)
```

## Screens

| Route | Screen |
|---|---|
| `/` | Dashboard — service pipeline, warranty lookup, low stock, production, landed cost, profit by line |
| `/production` | BOM per model, landed cost build-up, start a batch (reserves parts, issues serial range) |
| `/service` | Service desk — call list/search, call detail + progress, proforma approve/resend, register a call |
| `/field` | Live tracking (map placeholder), technicians right now, efficiency (week/month) |
| `/inventory` | Live stock, re-order suggestions → purchase orders, issue standard kit to a van, van stock |
| `/accounts` | Accounts hub — quick actions, balances, searchable report catalogue |
| `/accounts/profitability` | Profit by product & service, GST, bank reconciliation, recent invoices, petty cash |
| `/hr` | Attendance, leave approve/reject, payroll, directory (search), add employee |
| `/tech` | Technician app — my jobs |
| `/tech/job/:code` | Job: fault, parts from van, send to office / invoice |
| `/tech/job/:code/invoice` | GST tax invoice, UPI / cash / later, collect & close |
| `/tech/onsite/:code` | 6-step on-site flow: verify → diagnose → identify → quote → work → close / pickup job card |

## Run locally

```bash
# 1. API (SQLite, no setup)
cd backend
cp .env.example .env
php database/migrate.php --fresh
php -S 127.0.0.1:8000 -t public public/index.php

# 2. Front end (another terminal) — /api is proxied to the PHP server
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## Deploy

### Front end → Vercel
1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → import the repo**, set **Root Directory = `frontend`** (framework Vite is detected).
3. Environment variables:
   - `VITE_API_URL` = your API base, e.g. `https://api.yourdomain.com/api`
   - `VITE_API_KEY` = same value as backend `API_KEY` (optional)
4. Deploy. `vercel.json` rewrites all routes to `index.html` for client-side routing.

Without `VITE_API_URL` the build runs in **demo mode** on the bundled sample data (`src/sample/data.json`); writes are not saved and a "Demo data" chip shows on each page.

### API → PHP host
1. Upload `backend/` and point the domain/sub-domain document root at `backend/public` (Apache uses the included `.htaccess`; on Nginx use `try_files $uri /index.php?$query_string;`).
2. Create a MySQL database and a `.env` from `.env.example`:
   ```
   DB_DRIVER=mysql
   DB_HOST=localhost
   DB_NAME=technothics
   DB_USER=...
   DB_PASS=...
   CORS_ORIGINS=https://your-app.vercel.app
   API_KEY=some-long-random-string
   ```
3. Run `php database/migrate.php` once (SSH, or a one-off cron job on shared hosting).
4. Check `https://api.yourdomain.com/api/health`.

## API

All responses are JSON. When `API_KEY` is set, POST/PATCH need header `X-Api-Key`.

| Method | Path | |
|---|---|---|
| GET | `/health` | status |
| GET | `/dashboard` | dashboard data |
| GET | `/warranty/{serial}` | warranty status of a serial |
| GET | `/production?model=` | models, BOM, landed cost, batches |
| POST | `/batches` | `{model, qty, labour?, overhead?}` start batch, reserve parts |
| GET | `/service` | tickets, technicians, stats |
| POST | `/service/tickets` | `{phone, serial, complaint, auto_assign}` |
| POST | `/service/tickets/{code}/approve` · `/resend` · `/close` | |
| GET | `/field?period=week\|month` | |
| GET | `/inventory` | stock, re-order list, vans |
| POST | `/purchase-orders` | `{item_ids: []}` |
| POST | `/vans/issue` | `{tech}` load standard kit |
| GET | `/accounts` · `/accounts/profitability` | |
| GET | `/hr?q=` | |
| POST | `/hr/employees` | `{name, role, dept, …}` |
| PATCH | `/hr/leaves/{id}` | `{status: approved\|rejected}` |
| GET | `/tech/jobs` · `/tech/jobs/{code}` · `/tech/onsite/{code}` | technician app |
| POST | `/tech/jobs/{code}/report` · `/invoice` · `/collect` | job report, GST invoice, payment + close |

## Notes / next steps
- Summary figures that would normally come from the ledger (revenue, GST totals, attendance, field KPIs) are stored in the `metrics` table and seeded from `backend/database/seed.json`; lists (tickets, stock, BOM, batches, serials, employees, leaves, invoices, vans) are real tables. Replace metrics with live queries as modules are built out.
- Not yet built: login/roles, WhatsApp/SMS sending, real map & GPS, UPI QR generation, voucher posting to a ledger, report pages (the report tiles are placeholders).
- After changing seed data, refresh the demo snapshot: start the API, then `cd frontend && npm run snapshot`.

## Testing
`tests/e2e.cjs` clicks through every function (82 checks: navigation, filters, forms, saves, technician app, on-site flow, mobile layout).
```bash
php backend/database/migrate.php --fresh            # live mode needs a fresh DB
node tests/e2e.cjs http://localhost:5173 live       # with `npm run dev` + PHP API running
node tests/e2e.cjs http://localhost:4173 demo       # with `npm run build && npm run preview`
```
