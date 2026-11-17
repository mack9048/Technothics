import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { Bar, Loading, Money, PageChip, Pills, Stat, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { inr, pad2, rs } from '../lib/format';

export default function Production() {
  const [model, setModel] = useState('1100VA Home');
  const { data, error, reload, mutate } = useApi('/production?model=' + encodeURIComponent(model));
  const [qty, setQty] = useState(12);
  const [labour, setLabour] = useState('');
  const [overhead, setOverhead] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    if (data) {
      setLabour(String(data.model.labour));
      setOverhead(String(data.model.overhead));
    }
  }, [data]);

  if (!data) return <Loading error={error} onRetry={reload} />;

  const bomTotal = data.bom_total;
  const landed = bomTotal + (Number(labour) || 0) + (Number(overhead) || 0);
  const price = data.model.dealer_price;
  const margin = price > 0 ? (((price - landed) / price) * 100).toFixed(1) : '0.0';
  const prefix = `INV-${data.model.code}-${data.yymm}-`;
  const from = data.next_serial;
  const serial = (n) => prefix + String(n).padStart(5, '0');

  async function start() {
    setBusy(true);
    try {
      const res = await api.post('/batches', { model: data.model.name, qty, labour: Number(labour), overhead: Number(overhead) });
      if (res.demo) {
        mutate((d) => ({
          ...d,
          next_serial: d.next_serial + qty,
          batches: [{ code: `B-${d.yymm}-${pad2(d.batches.length + 4)}`, model: d.model.name, qty, stage: 'Assembly', serial_from: serial(from), serial_to: String(from + qty - 1).padStart(5, '0'), progress: 5 }, ...d.batches],
        }));
        showToast('Batch started (demo — not saved)');
      } else {
        showToast(`Batch ${res.batch.code} started` + (res.short_parts.length ? ` · short: ${res.short_parts.join(', ')}` : ''));
        reload();
      }
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-head">
        <div className="page-title"><PageChip>Production</PageChip><h1>Production &amp; costing</h1></div>
        <div className="stats">
          <Stat label="Active models">{pad2(data.stats.active_models)}</Stat>
          <Stat label="Units on the line">{data.stats.units_on_line}</Stat>
          <Stat label={`Landed cost · ${data.model.name.replace(' Home', '').replace(' Heavy', '')}`}><Money value={landed} /></Stat>
        </div>
      </section>

      <div className="toolbar">
        <div className="pills">
          <Pills label="Model" options={data.models} value={model} onChange={setModel} />
          <button className="icon-btn" aria-label="Add model" onClick={() => showToast('Adding models: coming soon')}><Icon name="plus" stroke={2.5} /></button>
        </div>
        <button className="btn sm outline" onClick={() => showToast('Duplicate BOM: coming soon')}>Duplicate BOM</button>
      </div>

      <div className="row">
        <section aria-label="Bill of materials" className="card dark col-main">
          <div className="card-head">
            <div className="stack" style={{ '--gap': '0px' }}>
              <span className="card-title">Bill of materials · {data.model.name}</span>
              <span className="card-sub">Per unit · prices from last purchase (FIFO)</span>
            </div>
            <button className="btn ink2" style={{ height: 44 }}>+ Add component</button>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 620 }}>
              <thead><tr><th>Component</th><th>Spec</th><th className="r">Qty</th><th className="r">Unit ₹</th><th className="r">Line ₹</th><th className="r">Stock covers</th></tr></thead>
              <tbody>
                {data.bom.length === 0 && <tr><td colSpan={6} className="dim">No components yet for this model.</td></tr>}
                {data.bom.map((b) => (
                  <tr key={b.component}>
                    <td className="semi">{b.component}</td><td className="dim">{b.spec}</td><td className="r">{b.qty}</td>
                    <td className="r">{inr(b.unit)}</td><td className="r">{inr(b.line)}</td>
                    <td className="r" style={{ color: b.low ? 'var(--amber)' : 'var(--teal)' }}>{b.cover} units</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4} className="semi">Component total</td><td className="r" style={{ fontSize: 22, fontWeight: 600, color: 'var(--teal)' }}>{rs(bomTotal)}</td><td /></tr></tfoot>
            </table>
          </div>
        </section>

        <div className="col-side">
          <section aria-label="Cost build-up" className="card mint">
            <span className="card-title">Landed cost build-up</span>
            <div className="kv"><span>Components (BOM)</span><span className="semi">{rs(bomTotal)}</span></div>
            <div className="kv" style={{ alignItems: 'center' }}><label htmlFor="labour">Labour / unit</label><input id="labour" inputMode="decimal" className="input num" value={labour} onChange={(e) => setLabour(e.target.value)} /></div>
            <div className="kv" style={{ alignItems: 'center' }}><label htmlFor="ovh">Power &amp; overhead / unit</label><input id="ovh" inputMode="decimal" className="input num" value={overhead} onChange={(e) => setOverhead(e.target.value)} /></div>
            <div className="kv total split" style={{ paddingTop: 12 }}><span>Landed cost</span><span className="big"><Money value={landed} /></span></div>
            <div className="kv small muted-2" style={{ fontSize: 14 }}><span>Dealer price {rs(price)}</span><span>Margin {margin}%</span></div>
          </section>

          <section aria-label="New batch" className="card teal">
            <span className="card-title">Start a production batch</span>
            <div className="between">
              <span style={{ fontSize: 15 }}>Quantity</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="qty-btn" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span style={{ fontSize: 32, fontWeight: 600, minWidth: 48, textAlign: 'center' }} aria-live="polite">{qty}</span>
                <button className="qty-btn" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(200, q + 1))}>+</button>
              </div>
            </div>
            <div className="stack" style={{ background: 'var(--mint)', borderRadius: 16, padding: '12px 14px', '--gap': '4px' }}>
              <span className="small muted-2">Serial numbers to be issued</span>
              <span className="bold" style={{ fontSize: 16 }}>{serial(from)}</span>
              <span className="small muted-2">to</span>
              <span className="bold" style={{ fontSize: 16 }}>{serial(from + qty - 1)}</span>
            </div>
            <span className="small">Format: INV · model · YYMM · running no. Printed as QR label; warranty starts on sale date.</span>
            <button className="btn lg dark" onClick={start} disabled={busy || data.bom.length === 0}>{busy ? 'Starting…' : 'Reserve parts & start'}</button>
          </section>
        </div>
      </div>

      <section aria-label="Batches" className="card soft" style={{ gap: 14 }}>
        <span className="card-title">Batches on the floor</span>
        <div className="grid-auto">
          {data.batches.map((t) => (
            <div key={t.code} className="tile soft">
              <div className="between"><span className="bold">{t.code}</span><span className="badge">{t.stage}</span></div>
              <span style={{ fontSize: 15 }}>{t.model} · {t.qty} units</span>
              <span className="small muted">{t.serial_from} → {t.serial_to}</span>
              <Bar pct={t.progress} className="thin on-soft" />
            </div>
          ))}
        </div>
      </section>
      <Toast msg={toast} />
    </>
  );
}
