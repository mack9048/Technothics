import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Loading, Modal, PageChip, Toast } from '../components/ui';
import { useApi, useToast } from '../lib/hooks';
import { rs } from '../lib/format';

const ACTIONS = [
  { label: 'Receive payment', sub: 'Customer, dealer & service receipts', icon: 'receive', bg: '#0E7C86' },
  { label: 'Make payment', sub: 'Suppliers, salaries & expenses', icon: 'pay', bg: '#C2410C' },
  { label: 'Transfer money', sub: 'Cash, bank & UPI transfers', icon: 'transfer', bg: '#3A2FA8' },
  { label: 'New invoice', sub: 'Tax invoice, proforma, credit note', icon: 'plus', bg: '#0B1026' },
];

const T = '#0E7C86', I = '#3A2FA8', R = '#C2410C', B = '#2D5BD8', K = '#0B1026';
const GROUPS = [
  ['Sales & service', 'Invoices, service billing and dealer dues', [
    ['Sales Register', 'Tax invoices by date & dealer', 'receipt', T],
    ['Service Billing', 'Warranty, chargeable & multi-brand', 'wrench', I],
    ['Proforma Register', 'Quotes sent, approved, pending', 'file', R],
    ['Dealer Outstanding', 'Dues & credit limits', 'users', B],
  ]],
  ['Purchase & stock', 'Suppliers, stock value and production cost', [
    ['Purchase Register', 'Supplier bills & goods received', 'cart', B],
    ['Supplier Outstanding', 'Payables by due date', 'truck', R],
    ['Stock Valuation', 'Warehouse + van stock value', 'box', T],
    ['Production Cost', 'Landed cost per batch & serial', 'chip', I],
  ]],
  ['Books & statements', 'Day book, ledgers, final statements and bank', [
    ['Day Book', 'Daily cash & bank activity', 'book', B],
    ['Ledger', 'Account statements', 'list', I],
    ['Journals', 'Vouchers & opening entries', 'pen', T],
    ['Trial Balance', 'Debit = credit check', 'scale', K],
    ['Profit & Loss', 'Income vs expense', 'trend', T],
    ['Balance Sheet', 'Assets & liabilities', 'scale', R],
    ['Bank Reconciliation', 'Match statement & books', 'bank', B],
    ['Transfer Reports', 'Cash, bank & UPI movements', 'transfer', I],
  ]],
  ['GST & compliance', 'Returns, e-way bills and HSN / SAC summary', [
    ['GSTR-1', 'Outward supplies · due 11th', 'calendar', T],
    ['GSTR-3B', 'Summary return · due 20th', 'calendar', I],
    ['E-way Bills', 'Dispatches above ₹50,000', 'truck', R],
    ['HSN / SAC Summary', 'Tax by product & service code', 'hash', K],
  ]],
  ['Profit & recovery', 'Margins, warranty cost, aging and cash flow', [
    ['Product Profitability', 'Margin per model & service line', 'pie', T, '/accounts/profitability'],
    ['Warranty Cost', 'Free service cost per model', 'shield', I],
    ['Receivables Aging', 'Dues by 0–30, 31–60, 60+ days', 'clock', R],
    ['Cash Flow', 'Operating, investing, financing', 'cash', B],
  ]],
];

export default function Accounts() {
  const { data, error, reload } = useApi('/accounts');
  const [q, setQ] = useState('');
  const [action, setAction] = useState(null);
  const [toast, showToast] = useToast();

  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return GROUPS;
    return GROUPS.map(([h, s, items]) => [h, s, items.filter(([t, d]) => (t + ' ' + d).toLowerCase().includes(n))]).filter((g) => g[2].length);
  }, [q]);

  if (!data) return <Loading error={error} onRetry={reload} />;

  return (
    <>
      <section className="page-head" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
        <div className="stack">
          <PageChip>{data.fy}</PageChip>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.3 }}>Accounts</h1>
        </div>
        <div className="field" style={{ flex: '0 1 360px' }}>
          <label htmlFor="rsearch" className="label" style={{ color: 'var(--muted)' }}>Find a report or ledger</label>
          <input id="rsearch" className="input pill-input" placeholder="e.g. GSTR-1, Dealer – Aluva" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </section>

      <div className="grid-auto" style={{ '--min': '260px', gap: 16 }}>
        {ACTIONS.map((a) => (
          <button key={a.label} className="action-tile" style={{ background: a.bg }} onClick={() => setAction(a.label)}>
            <span className="action-icon"><Icon name={a.icon} size={22} /></span>
            <span className="stack" style={{ '--gap': '4px' }}><span style={{ fontSize: 18, fontWeight: 700 }}>{a.label}</span><span style={{ fontSize: 14, color: '#F2F5FF' }}>{a.sub}</span></span>
          </button>
        ))}
      </div>

      <div className="grid-auto" style={{ '--min': '200px' }}>
        {data.balances.map((b) => (
          <div key={b.label} className="stack" style={{ background: 'var(--soft)', borderRadius: 20, padding: '16px 18px', '--gap': '4px' }}>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>{b.label}</span>
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.5 }}>{rs(b.amount)}</span>
          </div>
        ))}
      </div>

      <section id="reports" aria-label="Reports" className="card mint" style={{ padding: 28, gap: 28 }}>
        <div className="stack" style={{ '--gap': '4px' }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Reports</h2>
          <span style={{ fontSize: 15 }} className="muted-2">Sales and purchase first, then books, GST, and profit &amp; recovery</span>
        </div>
        {groups.length === 0 && <span className="muted-2">No report matches “{q}”.</span>}
        {groups.map(([heading, sub, items]) => (
          <div key={heading} className="stack" style={{ '--gap': '14px' }}>
            <div className="stack" style={{ '--gap': '2px', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>{heading}</h3>
              <span className="small muted-2">{sub}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {items.map(([title, desc, icon, bg, to]) => {
                const inner = (
                  <>
                    <span className="report-icon" style={{ background: bg }}><Icon name={icon} /></span>
                    <span className="stack" style={{ flex: 1, minWidth: 0, '--gap': '3px' }}><span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span><span className="small muted-2">{desc}</span></span>
                    <span className="report-chev" aria-hidden="true"><Icon name="chev" size={14} stroke={2.5} /></span>
                  </>
                );
                return to
                  ? <Link key={title} to={to} className="report-link">{inner}</Link>
                  : <button key={title} className="report-link" onClick={() => showToast(`${title}: report coming soon`)}>{inner}</button>;
              })}
            </div>
          </div>
        ))}
      </section>

      {action && <VoucherModal title={action} onClose={() => setAction(null)} onSave={() => { setAction(null); showToast(`${action} saved (voucher posting will be connected to the ledger API)`); }} />}
      <Toast msg={toast} />
    </>
  );
}

function VoucherModal({ title, onClose, onSave }) {
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" style={{ '--gap': '12px' }} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="field"><label className="label" htmlFor="vparty">Party / account</label><input id="vparty" className="input" required /></div>
        <div className="field"><label className="label" htmlFor="vamt">Amount (₹)</label><input id="vamt" className="input" inputMode="decimal" required /></div>
        <div className="field">
          <label className="label" htmlFor="vmode">Mode</label>
          <select id="vmode" className="input"><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Cheque</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="vnote">Narration</label><input id="vnote" className="input" /></div>
        <button className="btn lg dark">Save</button>
      </form>
    </Modal>
  );
}
