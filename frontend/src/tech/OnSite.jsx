import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loading, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { inr, pad2, rs } from '../lib/format';

const NAMES = ['Verification', 'Diagnosis', 'Identify fault', 'Quote', 'Work', 'Close job'];

function useTicker(running = true) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return secs;
}
const hms = (s) => `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;

export default function OnSite() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { data, error, reload } = useApi('/tech/onsite/' + code);
  const [step, setStep] = useState(() => Math.min(6, Math.max(1, Number(params.get('step')) || 1)));
  const [fault, setFault] = useState('Weak battery');
  const [where, setWhere] = useState('here');
  const [approved, setApproved] = useState(false);
  const [otp, setOtp] = useState(['4', '1', '7', '']);
  const [readings, setReadings] = useState({});
  const [checks, setChecks] = useState({});
  const [tasks, setTasks] = useState({});
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  const onSite = useTicker(true);
  const workSecs = useTicker(step === 5 && !paused);
  const otpRefs = useRef([]);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    setReadings(Object.fromEntries(data.readings.map((r) => [r.id, r.value])));
    setChecks(Object.fromEntries(data.checks.map((c) => [c.label, c.ok])));
    setTasks(Object.fromEntries(data.tasks.map((t) => [t.label, t.ok])));
  }, [data]);

  useEffect(() => { bodyRef.current?.scrollTo(0, 0); }, [step]);

  if (!data) return <Loading error={error} onRetry={reload} />;

  const q = data.quote;
  const qGst = q.lines.reduce((s, l) => s + l.amount * l.gst, 0);
  const qTotal = Math.round(q.lines.reduce((s, l) => s + l.amount, 0) + qGst);
  const battery = Number(readings.battery);
  const nexts = ['Start diagnosis', 'Identify fault', 'Make quote', 'Start work', 'Finish work', where === 'here' ? 'Collect & close' : 'Create pickup job card'];
  const w = data.warranty;

  async function next() {
    if (step < 6) return setStep(step + 1);
    setBusy(true);
    try {
      const res = await api.post(`/tech/jobs/${code}/report`, {
        kind: where === 'here' ? 'onsite_close' : 'pickup_job_card', fault, readings, checks, tasks, approved, quote_total: qTotal, work_seconds: workSecs,
      });
      showToast((where === 'here' ? 'Job closed' : 'Pickup job card created') + (res.demo ? ' (demo — not saved)' : ''));
      setTimeout(() => nav('/tech'), 1400);
    } catch (e) {
      showToast(e.message);
      setBusy(false);
    }
  }

  function typeOtp(i, v) {
    const d = v.replace(/\D/g, '').slice(-1);
    setOtp((o) => o.map((x, j) => (j === i ? d : x)));
    if (d && i < 3) otpRefs.current[i + 1]?.focus();
  }

  const choice = (on, label, onClick, height = 48, active = 'dark') => (
    <button onClick={onClick} aria-pressed={on} className={'btn ' + (on ? active : 'outline')} style={{ height, borderRadius: height > 50 ? 18 : 14, fontWeight: on ? 700 : 600, whiteSpace: 'normal' }}>{label}</button>
  );

  return (
    <>
      <div className="phone-top">
        <div className="between">
          <div className="stack" style={{ '--gap': '0px' }}><span className="small muted">{data.code} · {data.product.replace(/^Own /, 'Own brand ')}</span><span style={{ fontSize: 18, fontWeight: 700 }}>{data.customer}</span></div>
          <span className="badge dark" style={{ padding: '6px 10px' }}>On site {Math.floor(onSite / 60)}:{pad2(onSite % 60)}</span>
        </div>
        <div className="steps-bars" aria-hidden="true">{NAMES.map((n, i) => <div key={n} className={i < step ? 'on' : ''} />)}</div>
        <span className="small muted">Step {step} of 6 · <b style={{ color: 'var(--ink)' }}>{NAMES[step - 1]}</b></span>
      </div>

      <div className="phone-body" ref={bodyRef} style={{ padding: '14px 16px', gap: 12 }}>
        {step === 1 && (
          <section aria-label="Verification" className="stack" style={{ '--gap': '12px' }}>
            <div className="card dark r20" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <span className="circle-icon" style={{ width: 40, height: 40, background: 'var(--teal)', color: 'var(--ink)' }} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
              </span>
              <div className="stack" style={{ '--gap': '0px' }}><span className="bold">Checked in {new Date(Date.now() - onSite * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span><span className="small dim">GPS 40 m from customer address ✓</span></div>
            </div>
            <div className="card mint r20" style={{ gap: 8 }}>
              <span className="bold">Unit check</span>
              {w ? (
                <>
                  <div className="between"><span style={{ fontSize: 15 }}>{w.serial}</span><span className={'badge ' + (w.in_warranty ? 'teal' : 'peach')}>{w.in_warranty ? 'In warranty' : 'Chargeable'}</span></div>
                  <span className="small muted-2">Serial scanned matches ticket · sold {w.sold_on}</span>
                </>
              ) : <span className="small muted-2">Other-brand unit — no serial check.</span>}
              <button className="btn outline" style={{ height: 44 }} onClick={() => showToast('Camera opens to scan the QR label')}>Re-scan QR label</button>
            </div>
            <div className="card dark r20">
              <span className="bold">Customer verification</span>
              <span className="small dim">OTP sent to {data.phone} — ask the customer to read it out</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {otp.map((d, i) => (
                  <input key={i} ref={(el) => (otpRefs.current[i] = el)} aria-label={`OTP digit ${i + 1}`} className="otp" inputMode="numeric" value={d} onChange={(e) => typeOtp(i, e.target.value)} />
                ))}
              </div>
            </div>
            <PhotoSlot label="+ Photo of unit as found" height={76} onPick={() => showToast('Photo attached')} />
          </section>
        )}

        {step === 2 && (
          <section aria-label="Diagnosis" className="stack" style={{ '--gap': '12px' }}>
            <div className="card dark r20">
              <span className="bold">Readings</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {data.readings.map((r) => (
                  <div key={r.id} className="field" style={{ gap: 4 }}>
                    <label htmlFor={r.id} className="xs dim">{r.label}</label>
                    <input id={r.id} className="input on-dark" inputMode="decimal" value={readings[r.id] ?? ''} onChange={(e) => setReadings((x) => ({ ...x, [r.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {battery > 0 && battery < 11.5 && <span className="small" style={{ color: 'var(--peach)' }}>Battery {battery} V under load — below 11.5 V limit</span>}
            </div>
            <div className="card mint r20" style={{ gap: 6 }}>
              <span className="bold">Checklist</span>
              {data.checks.map((c) => (
                <label key={c.label} className="check"><input type="checkbox" checked={!!checks[c.label]} onChange={(e) => setChecks((x) => ({ ...x, [c.label]: e.target.checked }))} />{c.label}</label>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-label="Identify fault" className="stack" style={{ '--gap': '12px' }}>
            <span className="bold" style={{ fontSize: 15 }}>Fault found</span>
            <div role="group" aria-label="Fault" className="pills" style={{ gap: 6 }}>
              {data.faults.map((f) => <button key={f} className="pill sm teal" aria-pressed={fault === f} onClick={() => setFault(f)}>{f}</button>)}
            </div>
            <div className="card dark r20" style={{ gap: 8 }}>
              <span className="bold">Parts needed</span>
              <div className="kv"><span>150Ah tubular battery</span><span style={{ color: 'var(--peach)' }}>Not in van</span></div>
              <div className="kv"><span>Battery terminal set</span><span style={{ color: 'var(--teal)' }}>In van · 4</span></div>
            </div>
            <div className="card mint r20" style={{ gap: 8 }}>
              <span className="bold">Where can this be fixed?</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {choice(where === 'here', 'On site', () => setWhere('here'))}
                {choice(where !== 'here', 'Service centre', () => setWhere('centre'))}
              </div>
            </div>
          </section>
        )}

        {step === 4 && (
          <section aria-label="Quote" className="stack" style={{ '--gap': '12px' }}>
            <div className="card mint r20" style={{ padding: 16, gap: 8 }}>
              <div className="between"><span className="bold">Quote {q.no}</span><span className="badge peach">{q.note}</span></div>
              {q.lines.map((l, i) => <div key={l.label} className={'kv' + (i === 0 ? ' split' : '')}><span>{l.label}</span><span>{rs(l.amount)}</span></div>)}
              <div className="kv"><span>{q.free_line}</span><span className="bold" style={{ color: 'var(--deep-teal)' }}>Free · warranty</span></div>
              <div className="kv split muted-2" style={{ fontSize: 14 }}><span>GST (28% battery, 18% parts)</span><span>{rs(qGst)}</span></div>
              <div className="kv total"><span className="semi">Total</span><span style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>₹{inr(qTotal)}</span></div>
            </div>
            <div className="card dark r20">
              <span className="bold">Customer approval</span>
              {approved
                ? <span style={{ fontSize: 14, color: 'var(--teal)' }}>✓ Approved by customer OTP at {new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                : <span className="dim" style={{ fontSize: 14 }}>Sent on WhatsApp · waiting for the customer to tap Approve</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn outline-dark flex1" style={{ height: 44 }} onClick={() => showToast('Quote resent on WhatsApp')}>Resend</button>
                <button className="btn teal flex1" style={{ height: 44 }} onClick={() => setApproved(true)} disabled={approved}>Approved here</button>
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section aria-label="Work" className="stack" style={{ '--gap': '12px' }}>
            <div className="card dark r20" style={{ alignItems: 'center', gap: 4, padding: 16 }}>
              <span className="small dim">Work time</span>
              <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: 1 }} aria-live="off">{hms(workSecs)}</span>
              <button className="btn outline-dark" style={{ height: 40 }} onClick={() => setPaused((p) => !p)}>{paused ? 'Resume' : 'Pause'}</button>
            </div>
            <div className="card mint r20" style={{ gap: 6 }}>
              <span className="bold">Work done</span>
              {data.tasks.map((t) => (
                <label key={t.label} className="check"><input type="checkbox" checked={!!tasks[t.label]} onChange={(e) => setTasks((x) => ({ ...x, [t.label]: e.target.checked }))} />{t.label}</label>
              ))}
            </div>
            <div className="card dark r20" style={{ gap: 6 }}>
              <span className="bold">Final test</span>
              <span className="dim" style={{ fontSize: 14 }}>Output 229 V · backup on 400 W load: 2 h 10 min ✓</span>
            </div>
            <PhotoSlot label="+ Photo after work" height={64} onPick={() => showToast('Photo attached')} />
          </section>
        )}

        {step === 6 && (
          <section aria-label="Close job" className="stack" style={{ '--gap': '12px' }}>
            <span className="bold" style={{ fontSize: 15 }}>How does this job end?</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {choice(where === 'here', 'Fixed on site', () => setWhere('here'), 64, 'teal')}
              <button onClick={() => setWhere('centre')} aria-pressed={where !== 'here'} className={'btn ' + (where !== 'here' ? '' : 'outline')}
                style={{ height: 64, borderRadius: 18, whiteSpace: 'normal', fontWeight: where !== 'here' ? 700 : 600, background: where !== 'here' ? 'var(--peach)' : undefined, color: 'var(--ink)' }}>Take to service centre</button>
            </div>
            {where === 'here' ? (
              <div className="card mint r20" style={{ gap: 8 }}>
                <span className="bold">Invoice &amp; sign-off</span>
                <div className="kv"><span>Amount to collect</span><span className="bold">{rs(qTotal)}</span></div>
                <SignaturePad />
                <label className="check" style={{ fontSize: 14 }}><input type="checkbox" defaultChecked />Ask for a rating on WhatsApp</label>
              </div>
            ) : (
              <div className="card mint r20" style={{ gap: 8 }}>
                <span className="bold">Pickup job card JC-2611-012</span>
                <span className="small muted-2">Reason: transformer winding damage — needs bench test</span>
                <span className="semi" style={{ fontSize: 14 }}>Received with the unit</span>
                <label className="check" style={{ fontSize: 14 }}><input type="checkbox" defaultChecked />Inverter only (battery stays)</label>
                <label className="check" style={{ fontSize: 14 }}><input type="checkbox" />Mains cable</label>
                <div className="between"><label htmlFor="ret" style={{ fontSize: 14 }}>Expected return</label><input id="ret" type="date" className="input" defaultValue="2026-11-21" style={{ width: 150, height: 40, borderRadius: 10, fontSize: 14 }} /></div>
                <label className="check" style={{ fontSize: 14 }}><input type="checkbox" defaultChecked />Offer a standby inverter</label>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="phone-foot" style={{ flexDirection: 'row' }}>
        <button className="btn lg outline" style={{ flex: '0 0 96px' }} onClick={() => (step > 1 ? setStep(step - 1) : nav('/tech'))}>Back</button>
        <button className="btn lg teal" style={{ flex: 1 }} onClick={next} disabled={busy}>{nexts[step - 1]}</button>
      </div>
      <Toast msg={toast} />
    </>
  );
}

function PhotoSlot({ label, height, onPick }) {
  return (
    <label className="placeholder dashed" style={{ height, cursor: 'pointer' }}>
      {label}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} />
    </label>
  );
}

/** Finger / mouse signature capture on a canvas. */
function SignaturePad() {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  function pos(e) {
    const r = ref.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ref.current.width, ((e.clientY - r.top) / r.height) * ref.current.height];
  }
  function down(e) {
    drawing.current = true;
    ref.current.setPointerCapture(e.pointerId);
    const ctx = ref.current.getContext('2d');
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0B1026';
    ctx.beginPath(); ctx.moveTo(...pos(e));
  }
  function move(e) {
    if (!drawing.current) return;
    const ctx = ref.current.getContext('2d');
    ctx.lineTo(...pos(e)); ctx.stroke();
    setSigned(true);
  }
  function clear() {
    ref.current.getContext('2d').clearRect(0, 0, ref.current.width, ref.current.height);
    setSigned(false);
  }
  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={ref} width={680} height={160} aria-label="Customer signature" role="img"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)}
        style={{ width: '100%', height: 80, borderRadius: 14, background: '#fff', border: '1px solid var(--line)', touchAction: 'none', display: 'block' }} />
      {!signed && <span className="small muted-2" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>Customer signature</span>}
      {signed && <button className="badge" style={{ position: 'absolute', top: 6, right: 6, border: 'none' }} onClick={clear}>Clear</button>}
    </div>
  );
}
