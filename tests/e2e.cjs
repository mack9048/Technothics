// End-to-end check of every function in the Technothics UI.
// Usage (needs Playwright): node tests/e2e.cjs http://localhost:5173 live   (API on :8000, fresh DB)
//                            node tests/e2e.cjs http://localhost:4173 demo   (vite preview of a build without VITE_API_URL)
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:5173';
const MODE = process.argv[3] || 'live';
const API = 'http://127.0.0.1:8000/api';
const results = [];
let page;

async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, String(e.message).split('\n')[0].slice(0, 160)]);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const go = async (p) => { await page.goto(BASE + p); await page.waitForLoadState('networkidle'); };
const toast = async (re) => {
  const t = page.locator('.toast');
  let txt = '';
  for (let i = 0; i < 40; i++) {
    if (await t.count()) { txt = await t.innerText().catch(() => ''); if (re.test(txt)) return txt; }
    await page.waitForTimeout(100);
  }
  throw new Error(`toast "${txt}" !~ ${re}`);
};
const text = (sel) => page.locator(sel).first().innerText();
const api = async (path) => (await fetch(API + path)).json();
const btn = (name) => page.getByRole('button', { name, exact: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { const u = m.location().url || ''; if (m.type() === 'error' && !/api\/warranty\/XYZ/.test(u)) errors.push(m.text() + ' @ ' + u); });
  const demoTag = MODE === 'demo' ? /demo/i : /^(?!.*demo)/i;

  // ---------- Navigation ----------
  await check('Nav: all 7 main pages load from the menu', async () => {
    await go('/');
    for (const [label, h1] of [['Production', 'Production & costing'], ['Service', 'Service desk'], ['Field', 'Field service'], ['Inventory', 'Warehouse & stock'], ['Accounts', 'Accounts'], ['HR', 'People & HR'], ['Dashboard', 'Today at a glance']]) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label, exact: true }).click();
      await page.getByRole('heading', { level: 1, name: h1 }).waitFor({ timeout: 4000 });
      const active = await page.locator('.nav a.active').innerText();
      expect(active === label, `active tab ${active} != ${label}`);
    }
  });
  await check('Nav: unknown URL redirects to dashboard', async () => {
    await go('/does-not-exist');
    await page.getByRole('heading', { name: 'Today at a glance' }).waitFor();
  });
  await check('Nav: page refresh on a deep link works (/hr)', async () => {
    await go('/hr');
    await page.getByRole('heading', { name: 'People & HR' }).waitFor();
  });

  // ---------- Dashboard ----------
  await go('/');
  await check('Dashboard: KPIs shown (142 units, ₹18,46,200)', async () => {
    const t = await page.locator('.page-head').innerText();
    expect(t.includes('142') && t.includes('18,46,200') && t.includes('68%'), t);
  });
  await check('Dashboard: filter "Production" shows only production cards', async () => {
    await btn('Production').click();
    expect(await page.getByLabel('Service pipeline').count() === 0, 'pipeline still shown');
    expect(await page.getByLabel('Production this month').count() === 1, 'production card missing');
    expect(await page.getByLabel('Profit by line').count() === 0, 'profit shown');
  });
  await check('Dashboard: filter "Accounts" shows profit card only', async () => {
    await btn('Accounts').click();
    expect(await page.getByLabel('Profit by line').count() === 1, 'profit missing');
    expect(await page.getByLabel('Production this month').count() === 0, 'production shown');
  });
  await check('Dashboard: filter "Inventory" shows low stock', async () => {
    await btn('Inventory').click();
    expect(await page.getByLabel('Low stock').count() === 1, 'low stock missing');
    expect(await page.getByLabel('Service pipeline').count() === 0, 'pipeline shown');
  });
  await check('Dashboard: filter "All" restores everything', async () => {
    await btn('All').click();
    for (const l of ['Service pipeline', 'Warranty lookup', 'Low stock', 'Production this month', 'Landed cost per unit', 'Profit by line'])
      expect(await page.getByLabel(l).count() === 1, l + ' missing');
  });
  await check('Dashboard: warranty lookup — valid serial → In warranty', async () => {
    await page.getByLabel('Serial number').fill('INV-1K-2611-00482');
    await btn('Check').click();
    await page.getByText('In warranty', { exact: true }).waitFor({ timeout: 4000 });
    expect((await page.getByLabel('Warranty lookup').innerText()).includes('Anil Kumar'), 'customer missing');
  });
  await check('Dashboard: warranty lookup — expired serial → Expired', async () => {
    // demo snapshot includes all three sample serials
    await page.getByLabel('Serial number').fill('INV-5K-2409-00031');
    await btn('Check').click();
    await page.getByText('Expired', { exact: true }).waitFor({ timeout: 4000 });
  });
  await check('Dashboard: warranty lookup — unknown serial → error', async () => {
    await page.getByLabel('Serial number').fill('XYZ-123');
    await btn('Check').click();
    await page.locator('.error-box').waitFor({ timeout: 4000 });
    expect(/not found/i.test(await text('.error-box')), 'no not-found msg');
  });
  await check('Dashboard: Export downloads a CSV', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
    expect(dl.suggestedFilename() === 'technothics-dashboard.csv', dl.suggestedFilename());
  });
  await check('Dashboard: "Open service desk" link', async () => {
    await page.getByRole('link', { name: 'Open service desk' }).click();
    await page.getByRole('heading', { name: 'Service desk' }).waitFor();
    await go('/');
  });
  await check('Dashboard: "New call" → service register form', async () => {
    await page.getByRole('link', { name: 'New call' }).click();
    await page.getByRole('heading', { name: 'Service desk' }).waitFor();
    expect(page.url().endsWith('/service#register'), page.url());
    await go('/');
  });
  await check('Dashboard: "Raise purchase order" → inventory', async () => {
    await page.getByRole('link', { name: 'Raise purchase order' }).click();
    await page.getByRole('heading', { name: 'Warehouse & stock' }).waitFor();
    await go('/');
  });
  await check('Dashboard: "Open profitability report" → profit page', async () => {
    await page.getByRole('link', { name: 'Open profitability report' }).click();
    await page.getByRole('heading', { name: 'Profit & GST' }).waitFor();
  });

  // ---------- Production ----------
  await go('/production');
  await check('Production: BOM total ₹4,820 and landed ₹5,350', async () => {
    const t = await page.getByLabel('Cost build-up').innerText();
    expect(t.includes('4,820') && t.includes('5,350') && t.includes('27.7%'), t);
  });
  await check('Production: editing labour recalculates landed cost & margin', async () => {
    await page.getByLabel('Labour / unit').fill('450');
    const t = await page.getByLabel('Cost build-up').innerText();
    expect(t.includes('5,450') && t.includes('26.4%'), t);
    await page.getByLabel('Labour / unit').fill('350');
  });
  await check('Production: quantity +/− updates serial range', async () => {
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    let t = await page.getByLabel('New batch').innerText();
    expect(t.includes('INV-1K-2611-00501') && t.includes('INV-1K-2611-00513'), t);
    await page.getByRole('button', { name: 'Decrease quantity' }).click();
    await page.getByRole('button', { name: 'Decrease quantity' }).click();
    t = await page.getByLabel('New batch').innerText();
    expect(t.includes('00511'), t);
    await page.getByRole('button', { name: 'Increase quantity' }).click();
  });
  await check('Production: quantity cannot go below 1', async () => {
    for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'Decrease quantity' }).click();
    const t = await page.getByLabel('New batch').innerText();
    expect(/\n1\n/.test(t) || t.includes('00501\nto\nINV-1K-2611-00501'), t);
    for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Increase quantity' }).click();
  });
  await check('Production: switching model changes BOM', async () => {
    await btn('2kVA Heavy').click();
    await page.getByText('Bill of materials · 2kVA Heavy').waitFor({ timeout: 4000 });
    await btn('1100VA Home').click();
    await page.getByText('Bill of materials · 1100VA Home').waitFor({ timeout: 4000 });
  });
  await check('Production: "Reserve parts & start" creates a batch', async () => {
    const before = await page.getByLabel('Batches').locator('.tile').count();
    await btn('Reserve parts & start').click();
    await toast(MODE === 'demo' ? /demo/ : /Batch B-2611-08 started/);
    await page.waitForTimeout(800);
    const after = await page.getByLabel('Batches').locator('.tile').count();
    expect(after === before + 1, `batches ${before} -> ${after}`);
    expect((await page.getByLabel('New batch').innerText()).includes('00513'), 'next serial did not advance');
    if (MODE === 'live') {
      const inv = await api('/inventory');
      const mos = inv.items.find((i) => i.name === 'IRFZ44N MOSFET');
      expect(mos.reserved === 96 + 8 * 12, 'MOSFET reserved=' + mos.reserved);
    }
  });
  await check('Production: Add model / Duplicate BOM give feedback', async () => {
    await page.getByRole('button', { name: 'Add model' }).click();
    await toast(/coming soon/);
    await btn('Duplicate BOM').click();
    await toast(/coming soon/);
  });

  // ---------- Service ----------
  await go('/service');
  await check('Service: default call SR-1043 with proforma ₹1,593', async () => {
    const t = await page.getByLabel('Call detail').innerText();
    expect(t.includes('Fathima Stores') && t.includes('1,593'), t.slice(0, 200));
  });
  await check('Service: filters (Warranty / Chargeable / Multi-brand / Closed)', async () => {
    const calls = page.getByLabel('Calls').locator('.ticket-btn');
    await btn('Warranty').click(); const w = await calls.count();
    await btn('Chargeable').click(); const c = await calls.count();
    await btn('Multi-brand').click(); const m = await calls.count();
    await btn('Closed').click(); const cl = await calls.count();
    await btn('All calls').click(); const a = await calls.count();
    expect(w === 2 && c === 1 && m === 4 && cl === 0 && a === 7, `w${w} c${c} m${m} closed${cl} all${a}`);
  });
  await check('Service: search by serial / phone / ticket', async () => {
    const calls = page.getByLabel('Calls').locator('.ticket-btn');
    await page.getByLabel('Search by phone, serial or ticket').fill('INV-5K');
    expect(await calls.count() === 1, 'serial search');
    await page.getByLabel('Search by phone, serial or ticket').fill('SR-1047');
    expect(await calls.count() === 1, 'ticket search');
    await page.getByLabel('Search by phone, serial or ticket').fill('zzz');
    await page.getByText('No calls match.').waitFor();
    await page.getByLabel('Search by phone, serial or ticket').fill('');
  });
  await check('Service: selecting a call shows its detail + stepper', async () => {
    await page.getByRole('button', { name: /SR-1044 · Joseph P/ }).click();
    const t = await page.getByLabel('Call detail').innerText();
    expect(t.includes('INV-5K-2409-00031') && /Warranty ended/.test(t) && t.includes('Vishnu'), t.slice(0, 300));
    expect(await page.locator('.step.done').count() === 4, 'own-brand stepper should have 4 done');
  });
  await check('Service: "Mark approved" approves proforma', async () => {
    await page.getByRole('button', { name: /SR-1043 · Fathima/ }).click();
    await btn('Mark approved').click();
    await toast(MODE === 'demo' ? /demo/ : /Marked approved/);
    await btn('Approved').waitFor();
    expect(await btn('Approved').isDisabled(), 'not disabled');
    if (MODE === 'live') expect((await api('/service')).tickets.find((t) => t.code === 'SR-1043').approved === true, 'not saved');
  });
  await check('Service: "Resend" proforma', async () => {
    await btn('Resend').click();
    await toast(/resent/i);
    expect(/Resent on WhatsApp/.test(await page.getByLabel('Call detail').innerText()), 'resent text missing');
  });
  await check('Service: closing an own-brand call (SR-1042)', async () => {
    await page.getByRole('button', { name: /SR-1042 · Anil/ }).click();
    await btn('Close as free warranty').click();
    await toast(/SR-1042 closed/);
    await btn('Closed').click();
    expect(await page.getByLabel('Calls').locator('.ticket-btn').count() === 1, 'closed filter should show 1');
    await btn('All calls').click();
  });
  await check('Service: register call — required fields enforced', async () => {
    await btn('Create ticket & notify').click();
    const valid = await page.getByLabel('Customer phone').evaluate((el) => el.validity.valid);
    expect(!valid, 'empty phone accepted');
  });
  await check('Service: register own-brand call → auto-assigned ticket', async () => {
    await page.getByLabel('Customer phone').fill('98470 55555');
    await page.getByLabel('Serial no. or other brand').fill('INV-1K-2611-00482');
    await page.getByLabel('Complaint').fill('No backup');
    await btn('Create ticket & notify').click();
    const msg = await toast(/SR-\d+ created/);
    const code = msg.match(/SR-\d+/)[0];
    const t = await page.getByLabel('Call detail').innerText();
    expect(t.includes(code), 'new ticket not selected');
    if (MODE === 'live') {
      const tk = (await api('/service')).tickets.find((x) => x.code === code);
      expect(tk.tag === 'Warranty' && tk.tech && tk.stage === 'Assigned', JSON.stringify(tk).slice(0, 200));
    }
    expect(await page.getByLabel('Customer phone').inputValue() === '', 'form not cleared');
  });
  await check('Service: register other-brand call → Multi-brand', async () => {
    await page.getByLabel('Customer phone').fill('98470 66666');
    await page.getByLabel('Serial no. or other brand').fill('Luminous 900');
    await page.getByLabel('Complaint').fill('Beeping');
    await page.getByLabel('Auto-assign nearest free technician').uncheck();
    await btn('Create ticket & notify').click();
    const code2 = (await toast(/SR-1050 created/)).match(/SR-\d+/)[0];
    await page.getByLabel('Call detail').getByText(code2, { exact: false }).waitFor();
    const t = await page.getByLabel('Call detail').innerText();
    expect(t.includes('Multi-brand') && t.includes('Unassigned'), t.slice(0, 300));
  });

  // ---------- Field ----------
  await go('/field');
  await check('Field: live map + 4 technicians + 7 flow steps', async () => {
    expect(await page.getByLabel('Technicians in the field').locator('.tile').count() === 4, 'techs');
    expect(await page.getByRole('img', { name: /Map placeholder/ }).count() === 1, 'map');
    expect(await page.getByLabel('On-site process today').locator('> div').count() === 7, 'flow');
  });
  await check('Field: Week / Month toggle changes KPIs', async () => {
    const wk = await page.getByLabel('Work efficiency').innerText();
    await btn('Month').click();
    await page.getByText('Work efficiency · this month').waitFor({ timeout: 4000 });
    await page.getByText('76%', { exact: true }).waitFor({ timeout: 4000 });
    const mo = await page.getByLabel('Work efficiency').innerText();
    expect(wk.includes('78%') && mo.includes('76%'), 'kpis did not change');
    await btn('Week').click();
  });

  // ---------- Inventory ----------
  await go('/inventory');
  await check('Inventory: 8 items, 3 re-order', async () => {
    expect(await page.getByLabel('Stock').locator('tbody tr').count() === 8, 'rows');
    expect(await page.getByLabel('Re-order alerts').locator('input[type=checkbox]').count() === 3, 'reorder');
  });
  await check('Inventory: category filter', async () => {
    const rows = page.getByLabel('Stock').locator('tbody tr');
    await btn('Power parts').click(); const p = await rows.count();
    await btn('Transformers').click(); const t = await rows.count();
    await btn('All').click(); const a = await rows.count();
    expect(p === 3 && t === 1 && a === 8, `power${p} trans${t} all${a}`);
  });
  await check('Inventory: create purchase orders from ticked items', async () => {
    await page.getByLabel('Re-order alerts').locator('input[type=checkbox]').nth(2).uncheck();
    await btn('Create purchase orders').click();
    await toast(MODE === 'demo' ? /2 purchase orders.*demo/ : /Created PO-2611-001, PO-2611-002/);
  });
  await check('Inventory: no items ticked → warning', async () => {
    for (const cb of await page.getByLabel('Re-order alerts').locator('input[type=checkbox]').all()) await cb.uncheck();
    await btn('Create purchase orders').click();
    await toast(/Tick at least one/);
  });
  await check('Inventory: load standard kit to a van', async () => {
    await page.getByLabel('Technician').selectOption('Rahul');
    const card = page.getByLabel('Van stock').locator('.tile', { hasText: 'Rahul' });
    const before = await card.innerText();
    await btn('Load standard kit').click();
    await toast(/Rahul/);
    await page.waitForTimeout(800);
    const after = await card.innerText();
    expect(before !== after && after.includes('22 items'), after);
  });
  await check('Inventory: Goods received / Stock count feedback', async () => {
    await btn('Goods received').click(); await toast(/coming soon/);
    await btn('Stock count').click(); await toast(/coming soon/);
  });

  // ---------- Accounts ----------
  await go('/accounts');
  await check('Accounts: 5 balances + 24 report tiles', async () => {
    expect((await page.locator('main, body').innerText()).includes('6,48,200'), 'bank balance');
    expect(await page.locator('.report-link').count() === 24, 'tiles=' + (await page.locator('.report-link').count()));
  });
  await check('Accounts: report search filters tiles', async () => {
    await page.getByLabel('Find a report or ledger').fill('gstr');
    expect(await page.locator('.report-link').count() === 2, 'gstr');
    await page.getByLabel('Find a report or ledger').fill('qqq');
    await page.getByText(/No report matches/).waitFor();
    await page.getByLabel('Find a report or ledger').fill('');
  });
  await check('Accounts: report tile gives feedback', async () => {
    await page.locator('.report-link', { hasText: 'Day Book' }).click();
    await toast(/Day Book/);
  });
  for (const a of ['Receive payment', 'Make payment', 'Transfer money', 'New invoice']) {
    await check(`Accounts: "${a}" opens form, validates, saves`, async () => {
      await page.getByRole('button', { name: new RegExp('^' + a) }).click();
      const dlg = page.getByRole('dialog', { name: a });
      await dlg.waitFor();
      await dlg.getByRole('button', { name: 'Save' }).click();
      expect(await dlg.isVisible(), 'saved with empty fields');
      await dlg.getByLabel('Party / account').fill('Dealer – Aluva');
      await dlg.getByLabel('Amount (₹)').fill('5000');
      await dlg.getByRole('button', { name: 'Save' }).click();
      await toast(new RegExp(a + ' saved'));
      expect(await dlg.count() === 0, 'dialog still open');
    });
  }
  await check('Accounts: modal closes with ✕', async () => {
    await page.getByRole('button', { name: /^New invoice/ }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    expect(await page.getByRole('dialog').count() === 0, 'still open');
  });
  await check('Accounts: Product Profitability tile → profit page', async () => {
    await page.locator('.report-link', { hasText: 'Product Profitability' }).click();
    await page.getByRole('heading', { name: 'Profit & GST' }).waitFor();
  });

  // ---------- Profitability ----------
  await check('Profit: 7 lines, margins & warranty loss', async () => {
    const t = await page.getByLabel('Profitability').innerText();
    expect(page.locator('tbody tr') && t.includes('27.7%') && t.includes('− ₹12,800') && t.includes('60.0%'), t.slice(0, 300));
    expect(await page.getByLabel('Profitability').locator('tbody tr').count() === 7, 'rows');
  });
  await check('Profit: GST net ₹62,140, 5 recent invoices', async () => {
    expect((await page.getByLabel('GST').innerText()).includes('62,140'), 'gst');
    expect(await page.getByLabel('Recent documents').locator('.list-row').count() >= 5, 'docs');
  });
  await check('Profit: tab pills toggle, back link to Accounts', async () => {
    await btn('Bank').click();
    expect(await btn('Bank').getAttribute('aria-pressed') === 'true', 'pill');
    await page.getByRole('link', { name: /Accounts hub/ }).click();
    await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  });

  // ---------- HR ----------
  await go('/hr');
  await check('HR: attendance, 3 leave requests, payroll, 9 staff', async () => {
    expect(await page.getByLabel('Leave requests').locator('.tile').count() === 3, 'leaves');
    expect((await page.getByLabel('Payroll').innerText()).includes('5,92,000'), 'payroll');
    expect(await page.getByLabel('Employee directory').locator('tbody tr').count() === 9, 'staff');
  });
  await check('HR: directory search', async () => {
    await page.getByLabel('Search employees').fill('technician');
    expect(await page.getByLabel('Employee directory').locator('tbody tr').count() === 4, 'technicians');
    await page.getByLabel('Search employees').fill('');
  });
  await check('HR: approve leave', async () => {
    await page.getByLabel('Leave requests').getByRole('button', { name: 'Approve' }).first().click();
    await toast(/Ajmal: approved/);
    expect(await page.getByLabel('Leave requests').locator('.tile').count() === 2, 'not removed');
    expect((await page.getByLabel('Leave requests').innerText()).includes('2 pending'), 'count');
  });
  await check('HR: reject leave', async () => {
    await page.getByLabel('Leave requests').getByRole('button', { name: 'Reject' }).first().click();
    await toast(/rejected/);
    expect(await page.getByLabel('Leave requests').locator('.tile').count() === 1, 'not removed');
    if (MODE === 'live') expect((await api('/hr')).leaves.length === 1, 'not saved');
  });
  await check('HR: add employee', async () => {
    await btn('+ Add employee').click();
    const dlg = page.getByRole('dialog', { name: 'Add employee' });
    await dlg.getByLabel('Name').fill('Arun Mohan');
    await dlg.getByLabel('Role').fill('Assembly');
    await dlg.getByRole('button', { name: 'Save employee' }).click();
    await toast(/Arun Mohan added/);
    expect(await page.getByLabel('Employee directory').locator('tbody tr').count() === 10, 'not in list');
    if (MODE === 'live') expect((await api('/hr')).staff.some((s) => s.name === 'Arun Mohan' && s.initials === 'AM'), 'not saved');
  });
  await check('HR: "See technician efficiency" → Field', async () => {
    await page.getByRole('link', { name: 'See technician efficiency' }).click();
    await page.getByRole('heading', { name: 'Field service' }).waitFor();
  });

  // ---------- Technician app ----------
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.setViewportSize({ width: 390, height: 844 });
  page = phone;
  await check('Tech: footer link opens "My jobs"', async () => {
    await go('/');
    await page.getByRole('link', { name: 'My jobs' }).click();
    await page.getByText('My jobs', { exact: true }).waitFor();
    expect(await page.locator('a.card').count() >= 3, 'jobs=' + (await page.locator('a.card').count()));
  });
  await check('Tech: open job SR-1044', async () => {
    await page.locator('a.card', { hasText: 'SR-1044' }).click();
    await page.getByText('Job SR-1044').waitFor();
    const t = await page.locator('.phone-body').innerText();
    expect(t.includes('Joseph P') && t.includes('INV-5K-2409-00031') && t.includes('Chargeable'), t.slice(0, 300));
  });
  await check('Tech: Call / Navigate links are correct', async () => {
    expect((await page.getByRole('link', { name: 'Call' }).getAttribute('href')).startsWith('tel:'), 'tel');
    expect((await page.getByRole('link', { name: 'Navigate' }).getAttribute('href')).includes('maps.google.com'), 'maps');
  });
  await check('Tech: fault reason selection', async () => {
    await btn('PCB').click();
    expect(await btn('PCB').getAttribute('aria-pressed') === 'true', 'not pressed');
    await btn('Fan seized').click();
  });
  await check('Tech: parts +/− update total (₹873 → ₹979 → ₹873)', async () => {
    const foot = () => page.locator('.phone-foot').innerText();
    expect((await foot()).includes('₹873'), await foot());
    await page.getByRole('button', { name: 'More IRFZ44N MOSFET' }).click();
    expect((await foot()).includes('₹979'), await foot());
    await page.getByRole('button', { name: 'Fewer IRFZ44N MOSFET' }).click();
    await page.getByRole('button', { name: 'Fewer IRFZ44N MOSFET' }).click(); // cannot go below 0
    expect((await foot()).includes('₹873'), await foot());
  });
  await check('Tech: Send to office', async () => {
    await btn('Send to office').click();
    await toast(/Sent to office/);
    if (MODE === 'live') expect((await api('/service')).tickets.find((t) => t.code === 'SR-1044').stage === 'Parts logged', 'stage not saved');
  });
  await check('Tech: Invoice now → GST invoice ₹873 (CGST/SGST ₹66.60)', async () => {
    await btn('Invoice now').click();
    await page.getByText('Tax invoice', { exact: true }).waitFor();
    await page.getByLabel('Invoice').waitFor({ timeout: 4000 });
    const t = await page.getByLabel('Invoice').innerText();
    expect(t.includes('TI-2611-215') && t.includes('66.60') && t.includes('873') && t.includes('HSN 8414'), t);
  });
  await check('Tech: payment method switch (UPI/Cash/Later)', async () => {
    await btn('Cash').click();
    expect(/cash-in-hand/.test(await page.getByLabel('Payment', { exact: true }).innerText()), 'cash');
    await btn('Later').click();
    expect(/receivables/.test(await page.getByLabel('Payment', { exact: true }).innerText()), 'later');
    await btn('UPI').click();
    expect(await page.getByRole('img', { name: 'UPI QR code placeholder' }).count() === 1, 'upi');
  });
  await check('Tech: Collect & close job → back to jobs, ticket closed', async () => {
    await btn('Collect & close job').click();
    await toast(/Job closed · ₹873 collected/);
    await page.waitForURL(/\/tech$/, { timeout: 5000 });
    if (MODE === 'live') {
      const s = await api('/service?filter=Closed');
      expect(s.tickets.some((t) => t.code === 'SR-1044' && t.stage === 'Closed'), 'not closed');
      const p = await api('/accounts/profitability');
      expect(p.documents.some((d) => d.no === 'TI-2611-215' && Number(d.amount) === 873), 'invoice not in accounts');
    }
  });
  await check('Tech: back button returns to office app', async () => {
    await page.getByRole('link', { name: 'Back to office app' }).click();
    await page.getByRole('heading', { name: 'Today at a glance' }).waitFor();
  });

  // ---------- On-site flow ----------
  await go('/tech/onsite/SR-1046');
  const step = () => page.locator('.phone-top').innerText();
  await check('On-site 1: verification, OTP entry auto-advances', async () => {
    expect((await step()).includes('Step 1 of 6'), await step());
    const d4 = page.getByLabel('OTP digit 4');
    await page.getByLabel('OTP digit 3').fill('9');
    expect(await d4.evaluate((el) => el === document.activeElement), 'focus did not move');
    await d4.fill('a'); expect(await d4.inputValue() === '', 'accepted letter');
    await d4.fill('2'); expect(await d4.inputValue() === '2', 'digit');
  });
  await check('On-site: timer runs', async () => {
    const a = await page.locator('.phone-top .badge').innerText();
    await page.waitForTimeout(2100);
    const b = await page.locator('.phone-top .badge').innerText();
    expect(a !== b, `${a} == ${b}`);
  });
  await check('On-site 2: diagnosis, low battery warning reacts to reading', async () => {
    await btn('Start diagnosis').click();
    expect((await step()).includes('Step 2 of 6'), await step());
    await page.getByText(/below 11.5 V limit/).waitFor();
    await page.getByLabel('Battery (V, on load)').fill('12.4');
    expect(await page.getByText(/below 11.5 V limit/).count() === 0, 'warning still shown');
    await page.getByLabel('Battery water level').check();
    expect(await page.getByLabel('Battery water level').isChecked(), 'checkbox');
  });
  await check('On-site 3: fault + where to fix', async () => {
    await btn('Identify fault').click();
    await btn('Transformer').click();
    expect(await btn('Transformer').getAttribute('aria-pressed') === 'true', 'fault');
    await btn('Service centre').click();
    expect(await btn('Service centre').getAttribute('aria-pressed') === 'true', 'where');
  });
  await check('On-site 4: quote ₹18,004 and customer approval', async () => {
    await btn('Make quote').click();
    const t = await page.getByLabel('Quote').innerText();
    expect(t.includes('18,004') && t.includes('3,924'), t);
    await btn('Approved here').click();
    await page.getByText(/Approved by customer OTP/).waitFor();
  });
  await check('On-site 5: work timer + pause/resume, checklist', async () => {
    await btn('Start work').click();
    await page.waitForTimeout(1200);
    const t1 = await page.getByLabel('Work', { exact: true }).innerText();
    expect(!t1.includes('00:00:00'), 'timer not running');
    await btn('Pause').click();
    const a = await page.getByLabel('Work', { exact: true }).innerText(); await page.waitForTimeout(1200);
    expect(a === (await page.getByLabel('Work', { exact: true }).innerText()), 'timer ran while paused');
    await btn('Resume').click();
    await page.getByLabel('Area cleaned').check();
  });
  await check('On-site 6: close as service-centre pickup (choice carried from step 3)', async () => {
    await btn('Finish work').click();
    expect((await step()).includes('Step 6 of 6'), await step());
    await page.getByText(/Pickup job card/).waitFor();
    await btn('Create pickup job card').waitFor();
  });
  await check('On-site 6: switch to fixed on site + signature', async () => {
    await btn('Fixed on site').click();
    await page.getByText('Invoice & sign-off').waitFor();
    const c = page.getByRole('img', { name: 'Customer signature' });
    const b = await c.boundingBox();
    await page.mouse.move(b.x + 20, b.y + 40); await page.mouse.down();
    await page.mouse.move(b.x + 120, b.y + 20, { steps: 5 }); await page.mouse.move(b.x + 200, b.y + 50, { steps: 5 }); await page.mouse.up();
    await btn('Clear').waitFor();
    await btn('Clear').click();
    expect(await btn('Clear').count() === 0, 'clear did not reset');
  });
  await check('On-site: Back goes to previous step', async () => {
    await btn('Back').click();
    expect((await step()).includes('Step 5 of 6'), await step());
    await btn('Finish work').click();
  });
  await check('On-site: Collect & close saves report and returns to jobs', async () => {
    await btn('Collect & close').click();
    await toast(/Job closed/);
    await page.waitForURL(/\/tech$/, { timeout: 5000 });
  });
  await check('On-site: ?step=4 deep link opens Quote', async () => {
    await go('/tech/onsite/SR-1046?step=4');
    expect((await step()).includes('Step 4 of 6'), await step());
  });

  // ---------- Mobile layout ----------
  await check('Mobile: no horizontal scroll on any office page', async () => {
    for (const p of ['/', '/production', '/service', '/field', '/inventory', '/accounts', '/accounts/profitability', '/hr']) {
      await go(p);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw <= 390, `${p} scrollWidth ${sw}`);
    }
  });

  await check('No JavaScript errors in the console', async () => {
    expect(errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  await browser.close();
  const fails = results.filter((r) => r[0] === 'FAIL');
  for (const r of results) console.log(r.join('  '));
  console.log(`\n${MODE.toUpperCase()}: ${results.length - fails.length}/${results.length} passed`);
})();
