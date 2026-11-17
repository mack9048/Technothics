import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Loading, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/hooks';
import { inr, rs } from '../lib/format';

const DEFAULT = { parts: [{ name: '12V DC fan', qty: 1 }] };

export default function TechInvoice() {
  const { code } = useParams();
  const { state } = useLocation();
  const nav = useNavigate();
  const payload = state || DEFAULT;
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [whatsapp, setWhatsapp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await api.post(`/tech/jobs/${code}/invoice`, payload);
        if (live) setInv(res.demo ? demoInvoice(code, payload) : res);
      } catch (e) {
        if (live) setError(e.message);
      }
    })();
    return () => { live = false; };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!inv) return <Loading error={error} />;

  async function collect() {
    setBusy(true);
    try {
      const res = await api.post(`/tech/jobs/${code}/collect`, { ...payload, method, whatsapp });
      showToast(`Job closed · ${rs(inv.total)} ${method === 'Later' ? 'to receivables' : 'collected'}` + (res.demo ? ' (demo)' : ''));
      setTimeout(() => nav('/tech'), 1400);
    } catch (e) {
      showToast(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="phone-body">
        <div className="phone-nav">
          <Link to={`/tech/job/${code}`} aria-label="Back to job" className="icon-btn"><Icon name="back" /></Link>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Tax invoice</span>
          <span style={{ width: 44 }} />
        </div>

        <section aria-label="Invoice" className="card mint" style={{ padding: 18, gap: 8 }}>
          <div className="between"><span className="bold">{inv.no}</span><span className="small muted-2">{inv.date}</span></div>
          <span className="small muted-2">Bill to {inv.bill_to} · Job {inv.job}{inv.serial ? ` · ${inv.serial}` : ''}</span>
          {inv.lines.map((l, i) => (
            <div key={l.label} className={'kv' + (i === 0 ? ' split' : '')}><span>{l.label} <span className="xs muted-2">{l.code}</span></span><span>₹{inr(l.amount, 2)}</span></div>
          ))}
          <div className="kv split muted-2" style={{ fontSize: 14 }}><span>Taxable value</span><span>₹{inr(inv.taxable, 2)}</span></div>
          <div className="kv muted-2" style={{ fontSize: 14 }}><span>CGST 9%</span><span>₹{inr(inv.cgst, 2)}</span></div>
          <div className="kv muted-2" style={{ fontSize: 14 }}><span>SGST 9%</span><span>₹{inr(inv.sgst, 2)}</span></div>
          <div className="kv total split"><span className="semi">Total (rounded)</span><span className="big-40"><span className="rupee" style={{ fontSize: 18 }}>₹</span>{inr(inv.total)}</span></div>
        </section>

        <section aria-label="Payment" className="card dark" style={{ gap: 12 }}>
          <span className="semi" style={{ fontSize: 15 }}>Payment</span>
          <div role="group" aria-label="Payment method" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {['UPI', 'Cash', 'Later'].map((m) => (
              <button key={m} aria-pressed={method === m} onClick={() => setMethod(m)} className={'btn ' + (method === m ? 'teal' : 'outline-dark')} style={{ fontSize: 15 }}>{m}</button>
            ))}
          </div>
          {method === 'UPI' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--ink-2)', borderRadius: 18, padding: 14 }}>
              <div role="img" aria-label="UPI QR code placeholder" className="placeholder" style={{ width: 96, height: 96, borderRadius: 12, background: 'var(--mint)', flex: 'none' }}>[UPI QR]</div>
              <span className="dim" style={{ fontSize: 14 }}>Customer scans to pay {rs(inv.total)}. Payment auto-matches to this invoice.</span>
            </div>
          )}
          {method === 'Cash' && <span className="dim" style={{ fontSize: 14, background: 'var(--ink-2)', borderRadius: 18, padding: 14 }}>Cash {rs(inv.total)} will be added to your cash-in-hand, to deposit at office.</span>}
          {method === 'Later' && <span className="dim" style={{ fontSize: 14, background: 'var(--ink-2)', borderRadius: 18, padding: 14 }}>Invoice goes to receivables; office will follow up.</span>}
        </section>

        <label className="check"><input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />Send PDF to customer on WhatsApp</label>
      </div>

      <div className="phone-foot">
        <button className="btn xl teal" onClick={collect} disabled={busy}>{busy ? 'Closing…' : 'Collect & close job'}</button>
        <span className="xs muted" style={{ textAlign: 'center' }}>Van stock and accounts update automatically</span>
      </div>
      <Toast msg={toast} />
    </>
  );
}

function demoInvoice(code, payload) {
  const prices = { '12V DC fan': [140, '8414'], 'IRFZ44N MOSFET': [90, '8541'], 'Charging relay 30A': [220, '8536'] };
  const lines = payload.parts.filter((p) => p.qty > 0 && prices[p.name]).map((p) => ({ label: `${p.name} × ${p.qty}`, code: 'HSN ' + prices[p.name][1], amount: p.qty * prices[p.name][0] }));
  lines.push({ label: 'Service charge', code: 'SAC 9987', amount: 600 });
  const taxable = lines.reduce((s, l) => s + l.amount, 0);
  const half = Math.round(taxable * 0.09 * 100) / 100;
  return { no: 'TI-2611-215', date: '18 Nov 2026', bill_to: 'Joseph P', job: code, serial: 'INV-5K-2409-00031', lines, taxable, cgst: half, sgst: half, total: Math.round(taxable + 2 * half) };
}
