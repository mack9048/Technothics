import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Bar, Loading, Money, PageChip, Pills, Ring, Stat } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { pad2, rs } from '../lib/format';

const FILTERS = ['All', 'Production', 'Own-brand service', 'Multi-brand repair', 'Inventory', 'Accounts'];
const SHOWS = {
  pipeline: ['All', 'Own-brand service', 'Multi-brand repair'],
  side: ['All', 'Own-brand service', 'Multi-brand repair', 'Inventory'],
  bottom: ['All', 'Production', 'Accounts'],
};

export default function Dashboard() {
  const { data, error, reload } = useApi('/dashboard');
  const [filter, setFilter] = useState('All');
  const [serial, setSerial] = useState('INV-1K-2611-00482');
  const [warranty, setWarranty] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [checking, setChecking] = useState(false);

  if (!data) return <Loading error={error} onRetry={reload} />;
  const s = data.stats;
  const show = (k) => SHOWS[k].includes(filter);
  const maxCollected = Math.max(...s.collected_today.map((c) => c.amount));

  async function check(e) {
    e.preventDefault();
    setChecking(true);
    setLookupError(null);
    try {
      const w = await api.get('/warranty/' + encodeURIComponent(serial.trim()));
      setWarranty(w);
    } catch (err) {
      setWarranty(null);
      setLookupError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <section className="page-head">
        <div className="page-title">
          <PageChip>{s.date}</PageChip>
          <h1>Today at a glance</h1>
        </div>
        <Ring pct={s.warranty_closed_24h_pct} label="Warranty calls closed in 24 h" />
        <div className="stats">
          <Stat label="Units built (Nov)">{s.units_built_month}</Stat>
          <Stat label="Open service calls">{s.open_calls}</Stat>
          <Stat label="Revenue (Nov)"><Money value={s.revenue_month} /></Stat>
        </div>
      </section>

      <div className="toolbar">
        <Pills label="Filter" options={FILTERS} value={filter} onChange={setFilter} />
        <div className="pills">
          <button className="icon-btn" aria-label="Export" onClick={() => exportCsv(data)}><Icon name="export" /></button>
          <button className="icon-btn" aria-label="Settings"><Icon name="settings" /></button>
        </div>
      </div>

      {(show('pipeline') || show('side')) && (
        <div className="row">
          {show('pipeline') && (
            <section aria-label="Service pipeline" className="card dark col-main" style={{ gap: 22 }}>
              <div className="card-head">
                <div className="card-head-l">
                  <span className="circle-icon" style={{ background: '#fff', color: 'var(--ink)' }} aria-hidden="true"><Icon name="wrench" size={22} /></span>
                  <div className="stack" style={{ '--gap': '0px' }}>
                    <span className="card-title">Service pipeline</span>
                    <span className="card-sub">Own-brand warranty + multi-brand repair · this week</span>
                  </div>
                </div>
                <Link to="/service" aria-label="Open service desk" className="icon-btn lg on-dark"><Icon name="expand" size={18} /></Link>
              </div>

              <div className="grid-auto" style={{ '--min': '200px' }}>
                <div className="tile">
                  <span className="semi" style={{ fontSize: 15 }}>Awaiting inspection</span>
                  <span className="big">{pad2(s.awaiting_inspection)}</span>
                  {data.inspect.map((t) => (
                    <div key={t.code} className="between small dim split"><span>{t.code} · {t.customer}</span><span>{t.tech}</span></div>
                  ))}
                </div>
                <div className="tile">
                  <span className="semi" style={{ fontSize: 15 }}>Proforma awaiting approval</span>
                  <span className="big">{pad2(s.proforma_pending)}</span>
                  <span className="small dim">Quoted value</span>
                  <span className="num-26" style={{ color: 'var(--teal)' }}><Money value={s.proforma_value} /></span>
                  <div className="pills" style={{ gap: 6 }}>{s.proforma_channels.map((c) => <span key={c} className="badge outline">{c}</span>)}</div>
                </div>
                <div className="tile teal">
                  <span className="semi" style={{ fontSize: 15 }}>Collected today</span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
                    {s.collected_today.map((c) => (
                      <div key={c.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
                        <span className="xs semi">{rs(c.amount)}</span>
                        <div style={{ width: '100%', height: `${Math.max(12, (c.amount / maxCollected) * 75)}%`, background: c.amount === maxCollected ? 'var(--ink)' : 'var(--mint)', borderRadius: 12 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }} className="small semi">
                    {s.collected_today.map((c) => <span key={c.label} style={{ flex: 1, textAlign: 'center' }}>{c.label}</span>)}
                  </div>
                </div>
              </div>

              <div className="between wrap split" style={{ alignItems: 'flex-end', gap: 20, paddingTop: 18 }}>
                <BigStat label="Under warranty" value={pad2(s.under_warranty)} />
                <BigStat label="Chargeable" value={pad2(s.chargeable)} />
                <BigStat label="Multi-brand" value={pad2(s.multi_brand)} />
                <BigStat label="Avg. close time" value={<>{s.avg_close_days}<span style={{ fontSize: 18 }}> days</span></>} />
                <Link to="/service#register" className="btn xl teal"><Icon name="plus" size={18} stroke={2.5} />New call</Link>
              </div>
            </section>
          )}

          {show('side') && (
            <div className="col-side">
              <section aria-label="Warranty lookup" className="card mint" style={{ gap: 14 }}>
                <div className="card-head-l" style={{ gap: 12 }}>
                  <span className="circle-icon" style={{ background: '#fff', width: 48, height: 48 }} aria-hidden="true"><Icon name="shield" /></span>
                  <span className="card-title">Warranty lookup</span>
                </div>
                <form onSubmit={check} className="stack" style={{ '--gap': '14px' }}>
                  <label htmlFor="serial" className="label">Serial number</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="serial" className="input" value={serial} onChange={(e) => setSerial(e.target.value)} autoComplete="off" />
                    <button className="btn dark" style={{ borderRadius: 14 }} disabled={checking || !serial.trim()}>Check</button>
                  </div>
                </form>
                {lookupError && <div className="error-box">{lookupError}</div>}
                {warranty && (
                  <div className="tile white" style={{ gap: 6, borderRadius: 16 }}>
                    <div className="between">
                      <span className="semi">{warranty.model}</span>
                      <span className={'badge ' + (warranty.in_warranty ? 'teal' : 'peach')}>{warranty.in_warranty ? 'In warranty' : 'Expired'}</span>
                    </div>
                    <span className="small muted-2">Sold {warranty.sold_on} · Valid till {warranty.warranty_till} · {warranty.customer}</span>
                  </div>
                )}
              </section>

              {show('side') && filter !== 'Own-brand service' && filter !== 'Multi-brand repair' && (
                <section aria-label="Low stock" className="card mint" style={{ flex: 1 }}>
                  <div className="between">
                    <span className="card-title">Below re-order level</span>
                    <span className="badge amber">{data.low_stock.length} items</span>
                  </div>
                  {data.low_stock.map((i) => (
                    <div key={i.name} className="between split">
                      <div className="stack" style={{ '--gap': '0px' }}>
                        <span className="semi" style={{ fontSize: 15 }}>{i.name}</span>
                        <span className="small muted-2">Re-order at {i.reorder_level}</span>
                      </div>
                      <span className="num-26">{i.on_hand}</span>
                    </div>
                  ))}
                  <Link to="/inventory" className="btn dark block" style={{ marginTop: 'auto' }}>Raise purchase order</Link>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {show('bottom') && (
        <div className="grid-auto" style={{ '--min': '280px', gap: 20 }}>
          {filter !== 'Accounts' && (
            <section aria-label="Production this month" className="card soft" style={{ gap: 14 }}>
              <span className="card-title">Production · November</span>
              {data.production.map((m) => (
                <div key={m.name} className="stack" style={{ '--gap': '6px' }}>
                  <div className="between" style={{ fontSize: 14 }}><span>{m.name}</span><span className="semi">{m.units} units</span></div>
                  <Bar pct={m.pct} />
                </div>
              ))}
            </section>
          )}
          {filter !== 'Accounts' && (
            <section aria-label="Landed cost per unit" className="card soft" style={{ gap: 10 }}>
              <span className="card-title">Landed cost · {data.landed.model}</span>
              <div className="kv muted"><span>Components (BOM)</span><span>{rs(data.landed.bom)}</span></div>
              <div className="kv muted"><span>Labour</span><span>{rs(data.landed.labour)}</span></div>
              <div className="kv muted"><span>Power &amp; overhead</span><span>{rs(data.landed.overhead)}</span></div>
              <div className="kv total split" style={{ borderTopColor: 'var(--line-2)' }}><span>Cost per unit</span><span className="big-40"><Money value={data.landed.total} /></span></div>
              <span className="small muted">Selling price {rs(data.landed.price)} · Margin {data.landed.margin}%</span>
            </section>
          )}
          {filter !== 'Production' && (
            <section aria-label="Profit by line" className="card soft">
              <span className="card-title">Profit by business line</span>
              {s.profit_lines.map((l) => (
                <div key={l.name} className="list-row between" style={{ borderRadius: 16 }}>
                  <span style={{ fontSize: 15 }}>{l.name}</span><span style={{ fontSize: 20, fontWeight: 600 }}>{rs(l.value)}</span>
                </div>
              ))}
              <Link to="/accounts/profitability" className="small semi">Open profitability report</Link>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function BigStat({ label, value }) {
  return (
    <div className="stack" style={{ '--gap': '4px' }}>
      <span style={{ fontSize: 14, color: 'var(--on-dark-muted)' }}>{label}</span>
      <span className="big">{value}</span>
    </div>
  );
}

function exportCsv(data) {
  const rows = [['Metric', 'Value']];
  const s = data.stats;
  rows.push(['Units built (month)', s.units_built_month], ['Open service calls', s.open_calls], ['Revenue (month)', s.revenue_month]);
  data.production.forEach((m) => rows.push([`Production ${m.name}`, m.units]));
  s.profit_lines.forEach((l) => rows.push([`Profit ${l.name}`, l.value]));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'technothics-dashboard.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
