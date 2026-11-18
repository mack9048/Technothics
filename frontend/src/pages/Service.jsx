import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import { Loading, PageChip, Pills, Stat, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { pad2, rs } from '../lib/format';

const FILTERS = ['All calls', 'Warranty', 'Chargeable', 'Multi-brand', 'Closed'];
const TAG_BG = { 'Multi-brand': 'var(--peach)', Warranty: 'var(--teal)', Chargeable: 'var(--mint)' };
const STATUS_BG = { 'On site': 'var(--teal)', Workshop: 'var(--mint)', Free: 'var(--peach)' };

const MULTI_FLOW = ['Registered', 'Inspected', 'Proforma sent', 'Approved', 'Repaired', 'Tax invoice'];
const OWN_FLOW = ['Registered', 'Assigned', 'On site', 'Parts logged', 'Closed / invoiced'];

function progress(t) {
  if (t.kind === 'multi') {
    const map = { Registered: 0, Assigned: 0, 'Awaiting inspection': 0, Inspected: 1, 'Proforma sent': 2, Approved: 3, Repaired: 4, Closed: 5 };
    return { flow: MULTI_FLOW, done: map[t.stage] ?? 0 };
  }
  const map = { Registered: 0, Assigned: 1, 'On site': 2, 'In repair': 3, 'Parts logged': 3, Closed: 4 };
  return { flow: OWN_FLOW, done: map[t.stage] ?? 0 };
}

export default function Service() {
  const { data, error, reload, mutate } = useApi('/service');
  const [filter, setFilter] = useState('All calls');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [toast, showToast] = useToast();

  const tickets = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.tickets.filter((t) => {
      const ok =
        filter === 'All calls' ? t.stage !== 'Closed'
          : filter === 'Closed' ? t.stage === 'Closed'
            : filter === 'Multi-brand' ? t.kind === 'multi' : t.tag === filter;
      const hit = !needle || [t.code, t.phone, t.serial, t.customer].some((v) => v && String(v).toLowerCase().includes(needle));
      return ok && hit;
    });
  }, [data, filter, q]);

  if (!data) return <Loading error={error} onRetry={reload} />;
  const sel = tickets.find((t) => t.code === selId) || tickets[0];

  function replaceTicket(t) {
    mutate((d) => ({ ...d, tickets: d.tickets.map((x) => (x.code === t.code ? t : x)) }));
  }

  async function act(path, local, msg) {
    try {
      const res = await api.post(path);
      replaceTicket(res.ticket || local);
      showToast(res.demo ? msg + ' (demo — not saved)' : msg);
    } catch (e) {
      showToast(e.message);
    }
  }

  return (
    <>
      <section className="page-head">
        <div className="page-title"><PageChip>Service</PageChip><h1>Service desk</h1></div>
        <div className="stats">
          <Stat label="Open calls">{data.stats.open_calls}</Stat>
          <Stat label="Visits today">{pad2(data.stats.visits_today)}</Stat>
          <Stat label="Past 48 h SLA" style={{ color: 'var(--rust)' }}>{pad2(data.stats.past_sla)}</Stat>
        </div>
      </section>

      <div className="toolbar">
        <Pills label="Call type" options={FILTERS} value={filter} onChange={setFilter} />
        <a href="#register" className="btn sm teal"><Icon name="plus" size={18} stroke={2.5} />Register call</a>
      </div>

      <div className="row">
        <section aria-label="Calls" className="card mint" style={{ flex: '1 1 340px', padding: 18, gap: 10 }}>
          <label htmlFor="find" className="label" style={{ padding: '0 4px' }}>Search by phone, serial or ticket</label>
          <input id="find" className="input" placeholder="e.g. 98470… or INV-1K-…" value={q} onChange={(e) => setQ(e.target.value)} />
          {tickets.length === 0 && <span className="small muted-2" style={{ padding: 4 }}>No calls match.</span>}
          {tickets.map((t) => (
            <button key={t.code} className="ticket-btn" aria-pressed={sel?.code === t.code} onClick={() => setSelId(t.code)}>
              <span className="between" style={{ width: '100%' }}>
                <span className="bold">{t.code} · {t.customer}</span>
                <span className="badge" style={{ background: TAG_BG[t.tag] }}>{t.tag}</span>
              </span>
              <span className="t-meta">{t.product}</span>
              <span className="t-meta">{t.stage} · {t.tech || 'Unassigned'}</span>
            </button>
          ))}
        </section>

        {sel ? <Detail t={sel} act={act} /> : <section className="card dark" style={{ flex: '2 1 620px' }}><span className="dim">Select a call.</span></section>}
      </div>

      <div className="row">
        <RegisterForm onCreated={(t, demo) => { mutate((d) => ({ ...d, tickets: [t, ...d.tickets] })); setFilter('All calls'); setSelId(t.code); showToast(`${t.code} created` + (demo ? ' (demo — not saved)' : '')); }} onError={showToast} techs={data.techs}
          nextCode={'SR-' + (Math.max(1000, ...data.tickets.map((t) => Number(t.code.slice(3)))) + 1)} />
        <section aria-label="Technicians" className="card soft" style={{ flex: '1 1 420px' }}>
          <span className="card-title">Technicians today</span>
          {data.techs.map((k) => (
            <div key={k.name} className="list-row">
              <span className="avatar lg" aria-hidden="true">{k.init}</span>
              <div className="stack" style={{ flex: 1, '--gap': '0px' }}><span className="semi">{k.name}</span><span className="small muted">{k.area} · {k.jobs}</span></div>
              <span className="badge" style={{ background: STATUS_BG[k.status] }}>{k.status}</span>
            </div>
          ))}
        </section>
      </div>
      <Toast msg={toast} />
    </>
  );
}

function Detail({ t, act }) {
  const { flow, done } = progress(t);
  return (
    <section aria-label="Call detail" className="card dark" style={{ flex: '2 1 620px', gap: 22 }}>
      <div className="card-head">
        <div className="stack" style={{ '--gap': '2px' }}>
          <span style={{ fontSize: 14, color: 'var(--on-dark-muted)' }}>{t.code} · registered {t.date}</span>
          <span style={{ fontSize: 26, fontWeight: 600 }}>{t.customer}</span>
          <span className="dim" style={{ fontSize: 15 }}>{t.product}</span>
        </div>
        <span className="badge" style={{ background: TAG_BG[t.tag], fontSize: 13, padding: '6px 14px' }}>{t.tag}</span>
      </div>

      <div className="stepper" aria-label={`Progress: ${flow[done]}`}>
        {flow.map((label, i) => (
          <div key={label} className={'step' + (i <= done ? ' done' : '') + (i < done ? ' line-done' : '')}>
            <div className="step-line" />
            <span className="step-dot">{i <= done ? '✓' : i + 1}</span>
            <span className="step-text">{label}</span>
          </div>
        ))}
      </div>

      {t.kind === 'multi' && t.inspection && (
        <div className="grid-auto" style={{ '--min': '260px' }}>
          <div className="tile">
            <span className="semi" style={{ fontSize: 15 }}>Inspection report · {t.inspection.by}</span>
            <span className="dim" style={{ fontSize: 14 }}>Fault: {t.inspection.fault}</span>
            {t.inspection.lines.map((l, i) => (
              <div key={l.label} className={'kv' + (i === 0 ? ' split' : '')} style={{ fontSize: 14 }}><span>{l.label}</span><span>{rs(l.amount)}</span></div>
            ))}
          </div>
          <div className="tile teal">
            <span className="semi" style={{ fontSize: 15 }}>Proforma invoice {t.proforma.no}</span>
            <div className="kv" style={{ fontSize: 14 }}><span>Sub-total</span><span>{rs(t.proforma.subtotal)}</span></div>
            <div className="kv" style={{ fontSize: 14 }}><span>GST 18%</span><span>{rs(t.proforma.gst)}</span></div>
            <span className="big"><span className="rupee" style={{ fontSize: 20 }}>₹</span>{t.proforma.total.toLocaleString('en-IN')}</span>
            <span className="small">{t.proforma.sent} · {t.approved ? 'approved' : 'not yet approved'}</span>
            <div className="pills" style={{ marginTop: 'auto' }}>
              <button className="btn dark flex1" disabled={t.approved}
                onClick={() => act(`/service/tickets/${t.code}/approve`, { ...t, approved: true, stage: 'Approved' }, 'Marked approved')}>
                {t.approved ? 'Approved' : 'Mark approved'}
              </button>
              <button className="btn outline flex1" onClick={() => act(`/service/tickets/${t.code}/resend`, { ...t, proforma: { ...t.proforma, sent: 'Resent on WhatsApp just now' } }, 'Proforma resent on WhatsApp')}>Resend</button>
            </div>
          </div>
        </div>
      )}

      {t.kind === 'multi' && !t.inspection && (
        <div className="tile"><span className="semi">Inspection pending</span><span className="dim small">The technician's inspection report and proforma invoice will appear here.</span></div>
      )}

      {t.kind === 'own' && (
        <div className="grid-auto" style={{ '--min': '260px' }}>
          <div className="tile">
            <span className="semi" style={{ fontSize: 15 }}>Serial check</span>
            <span style={{ fontSize: 20, fontWeight: 600 }}>{t.serial}</span>
            <span className="dim" style={{ fontSize: 14 }}>{t.warranty_line}</span>
            <span className="dim" style={{ fontSize: 14 }}>{t.batch_line}</span>
          </div>
          <div className="tile">
            <span className="semi" style={{ fontSize: 15 }}>Technician update</span>
            <span className="dim" style={{ fontSize: 14 }}>Fault: {t.fault || t.complaint || 'Not reported yet'}</span>
            <span className="dim" style={{ fontSize: 14 }}>Parts used (from van stock): {t.parts || '—'}</span>
            {t.stage !== 'Closed' && (
              <button className="btn teal" style={{ marginTop: 'auto' }}
                onClick={() => act(`/service/tickets/${t.code}/close`, { ...t, stage: 'Closed' }, `${t.code} closed`)}>
                {t.action || 'Close call'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="between wrap split" style={{ alignItems: 'flex-end', gap: 20, paddingTop: 18 }}>
        <Info label="Technician" value={t.tech || 'Unassigned'} />
        <Info label="Notified via" value="App + WhatsApp" />
        <Info label="Phone" value={t.phone} />
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="stack" style={{ '--gap': '4px' }}>
      <span style={{ fontSize: 14, color: 'var(--on-dark-muted)' }}>{label}</span>
      <span style={{ fontSize: 30, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function RegisterForm({ onCreated, onError, techs, nextCode }) {
  const [form, setForm] = useState({ phone: '', serial: '', complaint: '', auto_assign: true });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/service/tickets', form);
      let t = res.ticket;
      if (res.demo) {
        const own = /^INV-/i.test(form.serial.trim());
        const free = techs.find((k) => k.status === 'Free');
        t = {
          code: nextCode, kind: own ? 'own' : 'multi', customer: 'New customer',
          product: own ? 'Own inverter' : form.serial + ' · other brand', serial: own ? form.serial.toUpperCase() : null,
          tag: own ? 'Warranty' : 'Multi-brand', stage: form.auto_assign ? 'Assigned' : 'Registered',
          tech: form.auto_assign ? free?.name : null, date: 'today', phone: form.phone, complaint: form.complaint,
          warranty_line: own ? 'Checked on save' : '', batch_line: '',
        };
      }
      onCreated(t, res.demo);
      setForm({ phone: '', serial: '', complaint: '', auto_assign: true });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="register" aria-label="Register a call" className="card mint" style={{ flex: '1 1 420px' }} onSubmit={submit}>
      <span className="card-title">Register a call</span>
      <div className="grid-auto" style={{ '--min': '180px', gap: 12 }}>
        <div className="field"><label htmlFor="rphone" className="label">Customer phone</label><input id="rphone" className="input" type="tel" required value={form.phone} onChange={set('phone')} /></div>
        <div className="field"><label htmlFor="rserial" className="label">Serial no. or other brand</label><input id="rserial" className="input" required value={form.serial} onChange={set('serial')} /></div>
      </div>
      <div className="field"><label htmlFor="rissue" className="label">Complaint</label><input id="rissue" className="input" required value={form.complaint} onChange={set('complaint')} /></div>
      <label className="check"><input type="checkbox" checked={form.auto_assign} onChange={set('auto_assign')} />Auto-assign nearest free technician</label>
      <button className="btn lg dark" disabled={busy}>{busy ? 'Creating…' : 'Create ticket & notify'}</button>
    </form>
  );
}
