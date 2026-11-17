import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, Money, Pills, Ring, Stat, Toast } from '../components/ui';
import { DEMO } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { rs, shortDate } from '../lib/format';

const DOC_BG = { 'Tax inv.': 'var(--teal)', Proforma: 'var(--peach)' };

export default function Profitability() {
  const { data, error, reload } = useApi('/accounts/profitability');
  const [tab, setTab] = useState('Overview');
  const [toast, showToast] = useToast();
  if (!data) return <Loading error={error} onRetry={reload} />;
  const maxMargin = 50; // bar scale: 50 % margin fills the bar

  return (
    <>
      <section className="page-head">
        <div className="page-title">
          <Link to="/accounts" className="chip">← Accounts hub · {data.month}{DEMO ? ' · Demo data' : ''}</Link>
          <h1>Profit &amp; GST</h1>
        </div>
        <Ring pct={data.bank_reconciled_pct} label="Bank entries reconciled" />
        <div className="stats">
          <Stat label="To receive"><Money value={data.to_receive} /></Stat>
          <Stat label="To pay"><Money value={data.to_pay} /></Stat>
        </div>
      </section>

      <div className="toolbar">
        <Pills label="Section" options={['Overview', 'Sales', 'Purchases', 'Bank', 'Petty cash', 'GST returns']} value={tab} onChange={setTab} />
        <button className="btn sm teal" onClick={() => showToast('New invoice: coming soon')}>+ New invoice</button>
      </div>

      <div className="row">
        <section aria-label="Profitability" className="card dark col-main" style={{ gap: 16 }}>
          <div className="stack" style={{ '--gap': '0px' }}>
            <span className="card-title">Profit by product &amp; service</span>
            <span className="card-sub">Cost = landed cost for inverters; parts + technician time for service</span>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 640 }}>
              <thead><tr><th>Line</th><th className="r">Revenue</th><th className="r">Cost</th><th className="r">Profit</th><th style={{ width: 180 }}>Margin</th></tr></thead>
              <tbody>
                {data.lines.map((l) => {
                  const weak = l.margin === null || l.margin < 15;
                  return (
                    <tr key={l.name}>
                      <td className="semi">{l.name}</td><td className="r">{rs(l.rev)}</td><td className="r dim">{rs(l.cost)}</td>
                      <td className="r semi" style={{ color: l.profit < 0 ? 'var(--peach)' : '#fff' }}>{rs(l.profit)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="bar thin" style={{ flex: 1 }}><div style={{ width: `${Math.max(0, Math.min(100, ((l.margin || 0) / maxMargin) * 100))}%`, background: weak ? 'var(--amber)' : 'var(--teal)' }} /></div>
                          <span className="small" style={{ width: 44, textAlign: 'right' }}>{l.margin === null ? '—' : l.margin.toFixed(1) + '%'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <span className="small" style={{ color: 'var(--on-dark-muted)' }}>Warranty service shows as a cost to the inverter line it belongs to, so each model's true margin includes its after-sales cost.</span>
        </section>

        <div className="col-side">
          <section aria-label="GST" className="card mint" style={{ gap: 10 }}>
            <span className="card-title">GST · November</span>
            <div className="kv"><span>Output GST (sales)</span><span>{rs(data.gst.output)}</span></div>
            <div className="kv"><span>Input tax credit</span><span>{rs(-data.gst.input_credit)}</span></div>
            <div className="kv total split"><span>Net payable</span><span className="big-40"><Money value={data.gst.net} /></span></div>
            <div className="pills" style={{ gap: 6 }}><span className="badge outline-light">GSTR-1 due {data.gst.gstr1_due}</span><span className="badge outline-light">GSTR-3B due {data.gst.gstr3b_due}</span></div>
            <div className="pills">
              <button className="btn dark flex1" style={{ fontSize: 14 }} onClick={() => showToast('GSTR-1 export: coming soon')}>Export GSTR-1</button>
              <button className="btn outline flex1" style={{ fontSize: 14 }}>E-way bills ({data.gst.eway_bills})</button>
            </div>
          </section>
          <section aria-label="Bank" className="card teal" style={{ gap: 10 }}>
            <span className="card-title">Bank reconciliation</span>
            <span className="big">{data.bank.unmatched}<span style={{ fontSize: 18 }}> unmatched entries</span></span>
            <span style={{ fontSize: 14 }}>Statement imported {data.bank.imported}. {data.bank.suggested} entries have a suggested match (UPI ref / amount).</span>
            <button className="btn dark">Review matches</button>
          </section>
        </div>
      </div>

      <div className="row">
        <section aria-label="Recent documents" className="card soft" style={{ flex: '2 1 560px', gap: 10 }}>
          <span className="card-title">Recent invoices</span>
          {data.documents.map((d) => (
            <div key={d.no} className="list-row wrap" style={{ borderRadius: 16 }}>
              <span className="badge" style={{ background: DOC_BG[d.type], minWidth: 76, textAlign: 'center' }}>{d.type}</span>
              <span className="semi" style={{ flex: '1 1 200px' }}>{d.no} · {d.party}</span>
              <span className="small muted">{shortDate(d.doc_date)}</span>
              <span style={{ fontSize: 17, fontWeight: 600, minWidth: 90, textAlign: 'right' }}>{rs(d.amount)}</span>
            </div>
          ))}
        </section>
        <section aria-label="Petty cash" className="card soft" style={{ flex: '1 1 300px', gap: 10 }}>
          <span className="card-title">Petty cash</span>
          <span className="big-40"><Money value={data.petty_cash.balance} /></span>
          {data.petty_cash.entries.map((e, i) => (
            <div key={e.label} className={'kv muted' + (i === 0 ? ' split' : '')} style={{ fontSize: 14, borderTopColor: 'var(--line-2)' }}><span>{e.label}</span><span>{rs(e.amount)}</span></div>
          ))}
          <button className="btn outline" style={{ marginTop: 'auto' }}>Add expense</button>
        </section>
      </div>
      <Toast msg={toast} />
    </>
  );
}
