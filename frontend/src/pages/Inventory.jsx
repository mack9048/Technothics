import { useEffect, useState } from 'react';
import { Loading, Money, PageChip, Pills, Stat, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { inr, rs } from '../lib/format';

const STATUS_BG = { 'Re-order': 'var(--amber)', OK: 'var(--teal)', Watch: 'var(--mint)' };

export default function Inventory() {
  const { data, error, reload, mutate } = useApi('/inventory');
  const [cat, setCat] = useState('All');
  const [picked, setPicked] = useState({});
  const [tech, setTech] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    if (data) {
      setPicked(Object.fromEntries(data.reorder.map((r) => [r.id, true])));
      setTech((t) => t || data.technicians.at(-1)?.name || '');
    }
  }, [data]);

  if (!data) return <Loading error={error} onRetry={reload} />;
  const items = cat === 'All' ? data.items : data.items.filter((i) => i.category === cat);
  const cats = ['All', 'Power parts', 'Resistors & caps', 'Transformers', 'Cabinets', 'Consumables'];

  async function createPOs() {
    const ids = Object.keys(picked).filter((k) => picked[k]).map(Number);
    if (!ids.length) return showToast('Tick at least one item');
    setBusy(true);
    try {
      const res = await api.post('/purchase-orders', { item_ids: ids });
      showToast(res.demo ? `${ids.length} purchase orders drafted (demo — not saved)` : `Created ${res.purchase_orders.map((p) => p.no).join(', ')}`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadKit() {
    setBusy(true);
    try {
      const res = await api.post('/vans/issue', { tech });
      if (res.demo) {
        mutate((d) => ({ ...d, vans: d.vans.map((v) => (v.tech === tech ? { ...v, items: v.items + 8, value: v.value + 832 } : v)) }));
        showToast(`Standard kit loaded to ${tech}'s van (demo — not saved)`);
      } else {
        showToast(`${res.issued_items} parts moved to ${tech}'s van`);
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
        <div className="page-title"><PageChip>Inventory</PageChip><h1>Warehouse &amp; stock</h1></div>
        <div className="stats">
          <Stat label="Items (SKUs)">{data.stats.skus}</Stat>
          <Stat label="Stock value"><Money value={data.stats.stock_value} /></Stat>
          <Stat label="In technicians' vans"><Money value={data.stats.van_value} /></Stat>
        </div>
      </section>

      <div className="toolbar">
        <Pills label="Category" options={cats} value={cat} onChange={setCat} />
        <div className="pills">
          <button className="btn sm outline" onClick={() => showToast('Goods received note: coming soon')}>Goods received</button>
          <button className="btn sm teal" onClick={() => showToast('Stock count sheet: coming soon')}>Stock count</button>
        </div>
      </div>

      <div className="row">
        <section aria-label="Stock" className="card dark col-main" style={{ gap: 16 }}>
          <div className="stack" style={{ '--gap': '0px' }}>
            <span className="card-title">Live stock</span>
            <span className="card-sub">Available = on hand − reserved for production batches</span>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 680 }}>
              <thead><tr><th>Item</th><th>Bin</th><th className="r">On hand</th><th className="r">Reserved</th><th className="r">In vans</th><th className="r">Re-order at</th><th>Status</th></tr></thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={7} className="dim">No items in this category.</td></tr>}
                {items.map((i) => (
                  <tr key={i.id}>
                    <td><span className="semi">{i.name}</span><br /><span className="small" style={{ color: 'var(--on-dark-muted)' }}>{i.category}</span></td>
                    <td className="dim">{i.bin}</td><td className="r">{inr(i.on_hand)}</td><td className="r dim">{inr(i.reserved)}</td>
                    <td className="r dim">{inr(i.in_vans)}</td><td className="r dim">{inr(i.reorder_level)}</td>
                    <td><span className="badge" style={{ background: STATUS_BG[i.status] }}>{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="col-side">
          <section aria-label="Re-order alerts" className="card mint">
            <div className="between"><span className="card-title">Re-order suggestions</span><span className="badge amber">{data.reorder.length}</span></div>
            {data.reorder.map((r) => (
              <label key={r.id} className="check split" style={{ gap: 12 }}>
                <input type="checkbox" checked={!!picked[r.id]} onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.checked }))} />
                <span className="stack" style={{ flex: 1, '--gap': '0px' }}><span className="semi">{r.name}</span><span className="small muted-2">{r.supplier} · last {rs(r.price)}</span></span>
                <span style={{ fontSize: 20, fontWeight: 600 }}>+{inr(r.qty)}</span>
              </label>
            ))}
            <button className="btn lg dark" onClick={createPOs} disabled={busy || !data.reorder.length}>Create purchase orders</button>
          </section>

          <section aria-label="Issue to van" className="card teal">
            <span className="card-title">Issue parts to a van</span>
            <label htmlFor="tech" style={{ fontSize: 14 }}>Technician</label>
            <select id="tech" className="input" style={{ border: 'none', background: 'var(--mint)' }} value={tech} onChange={(e) => setTech(e.target.value)}>
              {[...data.technicians].reverse().map((t) => <option key={t.name} value={t.name}>{t.name} · {t.area}</option>)}
            </select>
            <span style={{ fontSize: 14 }}>Scan part barcodes or pick from a standard van kit. Stock moves from Warehouse → Van, and leaves the books only when used on a job.</span>
            <button className="btn lg dark" onClick={loadKit} disabled={busy || !tech}>Load standard kit</button>
          </section>
        </div>
      </div>

      <section aria-label="Van stock" className="card soft" style={{ gap: 14 }}>
        <span className="card-title">Mobile inventory · technician vans</span>
        <div className="grid-auto">
          {data.vans.map((v) => (
            <div key={v.tech} className="tile soft">
              <div className="between"><span className="bold" style={{ fontSize: 17 }}>{v.tech}</span><span className="small muted">{v.items} items</span></div>
              <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 1 }}><Money value={v.value} /></span>
              <span className="small muted">Used today: {v.used_today}</span>
              <span className="small muted">Last reconciled {v.reconciled}</span>
            </div>
          ))}
        </div>
      </section>
      <Toast msg={toast} />
    </>
  );
}
