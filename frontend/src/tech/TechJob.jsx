import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Loading, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { rs } from '../lib/format';

export default function TechJob() {
  const { code } = useParams();
  const nav = useNavigate();
  const { data, error, reload } = useApi('/tech/jobs/' + code);
  const [fault, setFault] = useState('Fan seized');
  const [qty, setQty] = useState({});
  const [toast, showToast] = useToast();

  useEffect(() => {
    if (data) setQty(Object.fromEntries(data.van_parts.map((p, i) => [p.name, i === 0 ? 1 : 0])));
  }, [data]);

  if (!data) return <Loading error={error} onRetry={reload} />;
  const parts = data.van_parts.map((p) => ({ ...p, qty: qty[p.name] || 0 }));
  const partsTotal = parts.reduce((s, p) => s + p.qty * p.price, 0);
  const total = Math.round((partsTotal + data.labour) * (1 + data.gst_rate));
  const w = data.warranty;
  const step = (name, d) => setQty((q) => ({ ...q, [name]: Math.max(0, (q[name] || 0) + d) }));
  const payload = { fault, parts: parts.map(({ name, qty: n }) => ({ name, qty: n })) };

  async function sendToOffice() {
    try {
      const res = await api.post(`/tech/jobs/${code}/report`, { kind: 'send_to_office', ...payload });
      showToast('Sent to office' + (res.demo ? ' (demo — not saved)' : ''));
    } catch (e) {
      showToast(e.message);
    }
  }

  return (
    <>
      <div className="phone-body">
        <div className="phone-nav">
          <Link to="/tech" aria-label="Back to my jobs" className="icon-btn"><Icon name="back" /></Link>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Job {data.code}</span>
          <span className="badge dark" style={{ padding: '6px 12px' }}>On site</span>
        </div>

        <section aria-label="Customer" className="card dark">
          <span style={{ fontSize: 22, fontWeight: 600 }}>{data.customer}</span>
          <span className="dim" style={{ fontSize: 14 }}>{data.address}{data.complaint ? ` · complaint: ${data.complaint.toLowerCase()}` : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`tel:${data.phone.replace(/[^\d+]/g, '')}`} className="btn ink2 flex1" style={{ height: 44 }}><Icon name="phone" size={16} />Call</a>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(data.address || data.customer)}`} target="_blank" rel="noreferrer" className="btn ink2 flex1" style={{ height: 44 }}><Icon name="pin" size={16} />Navigate</a>
          </div>
        </section>

        {w && (
          <section aria-label="Serial" className="card mint" style={{ gap: 6 }}>
            <div className="between"><span className="small muted-2">Scanned serial</span><span className={'badge ' + (w.in_warranty ? 'teal' : 'peach')}>{w.in_warranty ? 'In warranty' : 'Chargeable'}</span></div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{w.serial}</span>
            <span className="small muted-2">{w.model} · {w.in_warranty ? `valid till ${w.warranty_till}` : `warranty ended ${w.warranty_till}`}</span>
          </section>
        )}

        <section aria-label="Fault" className="stack" style={{ '--gap': '8px' }}>
          <span className="semi" style={{ fontSize: 15 }}>Fault reason</span>
          <div role="group" aria-label="Fault reason" className="pills" style={{ gap: 6 }}>
            {data.faults.map((f) => <button key={f} className="pill sm" aria-pressed={fault === f} onClick={() => setFault(f)}>{f}</button>)}
          </div>
        </section>

        <section aria-label="Parts used" className="card dark">
          <div className="between"><span className="semi" style={{ fontSize: 15 }}>Parts used · from my van</span><span className="small" style={{ color: 'var(--on-dark-muted)' }}>{data.van_count} in van</span></div>
          {parts.map((p) => (
            <div key={p.name} className="split" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="stack" style={{ flex: 1, '--gap': '0px' }}><span className="semi" style={{ fontSize: 15 }}>{p.name}</span><span className="small" style={{ color: 'var(--on-dark-muted)' }}>{rs(p.price)} each</span></span>
              <button className="qty-btn sm" aria-label={`Fewer ${p.name}`} onClick={() => step(p.name, -1)}>−</button>
              <span style={{ fontSize: 18, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{p.qty}</span>
              <button className="qty-btn sm" aria-label={`More ${p.name}`} onClick={() => step(p.name, 1)}>+</button>
            </div>
          ))}
          <button className="btn outline-dark" style={{ height: 44, borderStyle: 'dashed', fontSize: 14, fontWeight: 400 }} onClick={() => showToast('Barcode scanner opens on the device')}>+ Add part / scan barcode</button>
        </section>

        <section aria-label="Photos" style={{ display: 'flex', gap: 8 }}>
          <label className="placeholder" style={{ flex: 1, height: 72, cursor: 'pointer' }}>Before photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={() => showToast('Before photo attached')} /></label>
          <label className="placeholder" style={{ flex: 1, height: 72, cursor: 'pointer' }}>After photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={() => showToast('After photo attached')} /></label>
        </section>
      </div>

      <div className="phone-foot">
        <div className="between" style={{ alignItems: 'baseline' }}><span className="muted" style={{ fontSize: 14 }}>Parts {rs(partsTotal)} + labour {rs(data.labour)}</span><span style={{ fontSize: 26, fontWeight: 600 }}>{rs(total)}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn lg outline flex1" onClick={sendToOffice}>Send to office</button>
          <button className="btn lg teal flex1" onClick={() => nav(`/tech/job/${code}/invoice`, { state: payload })}>Invoice now</button>
        </div>
      </div>
      <Toast msg={toast} />
    </>
  );
}
