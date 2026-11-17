import { useState } from 'react';
import { Loading, PageChip, Pills, Stat } from '../components/ui';
import { useApi } from '../lib/hooks';
import { pad2 } from '../lib/format';

const STATE_BG = { onsite: '#2EC4C0', travelling: '#F7C58A', free: '#EAF6F7' };

export default function Field() {
  const [period, setPeriod] = useState('Week');
  const { data, error, reload } = useApi('/field?period=' + period.toLowerCase());
  if (!data) return <Loading error={error} onRetry={reload} />;

  return (
    <>
      <section className="page-head">
        <div className="page-title"><PageChip>Live · {data.date}</PageChip><h1>Field service</h1></div>
        <div className="stats">
          <Stat label="Technicians out">{data.stats.techs_out}</Stat>
          <Stat label="Jobs today">{data.stats.jobs_today}</Stat>
          <Stat label="Closed">{pad2(data.stats.closed)}</Stat>
          <Stat label="To service centre">{pad2(data.stats.to_centre)}</Stat>
        </div>
      </section>

      <section aria-label="On-site process today" className="grid-auto" style={{ '--min': '150px', gap: 10 }}>
        {data.flow.map((f) => (
          <div key={f.n} className="stack" style={{ background: 'var(--soft)', borderRadius: 18, padding: '12px 14px', '--gap': '2px' }}>
            <span className="xs muted">{f.n}</span>
            <span className="bold" style={{ fontSize: 15 }}>{f.label}</span>
            <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>{f.count}</span>
          </div>
        ))}
      </section>

      <div className="row">
        <section aria-label="Live tracking" className="card dark col-main" style={{ padding: 20, gap: 14 }}>
          <div className="card-head">
            <div className="stack" style={{ '--gap': '0px' }}>
              <span className="card-title">Live tracking</span>
              <span className="card-sub">Location every 2 min while on duty · map shown as a placeholder</span>
            </div>
            <div className="pills small dim" style={{ gap: 12 }}>
              {[['On site', '#2EC4C0'], ['Travelling', '#F7C58A'], ['Free', '#EAF6F7']].map(([l, c]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />{l}</span>
              ))}
            </div>
          </div>
          <svg role="img" aria-label={`Map placeholder showing ${data.live.length} technicians and the service centre`} viewBox="0 0 800 380" style={{ width: '100%', height: 'auto', borderRadius: 20, background: '#1A2142' }}>
            <g fill="none" stroke="#2A3358" strokeWidth="10" strokeLinecap="round">
              <path d="M0 120 C200 100 300 180 520 150 S760 90 800 110" /><path d="M140 0 C160 120 120 260 180 380" />
              <path d="M420 0 C440 120 470 250 430 380" /><path d="M0 300 C220 280 420 320 800 270" /><path d="M600 0 C640 140 660 260 720 380" />
            </g>
            <path d="M300 215 C340 200 380 190 430 165" fill="none" stroke="#F7C58A" strokeWidth="3" strokeDasharray="8 8" />
            <g><rect x="360" y="230" width="140" height="34" rx="17" fill="#EAF6F7" /><text x="430" y="252" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0B1026" fontFamily="Urbanist, sans-serif">Service centre</text></g>
            {data.live.map((t) => (
              <g key={t.init}>
                <circle cx={t.map.x} cy={t.map.y} r="22" fill={STATE_BG[t.state]} />
                <text x={t.map.x} y={t.map.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0B1026" fontFamily="Urbanist, sans-serif">{t.init}</text>
                <text x={t.map.x} y={t.state === 'travelling' ? t.map.y - 23 : t.map.y + 40} textAnchor="middle" fontSize="13" fill="#CDD5EE" fontFamily="Urbanist, sans-serif">{t.map.label}</text>
              </g>
            ))}
          </svg>
        </section>

        <section aria-label="Technicians in the field" className="card mint" style={{ flex: '1 1 340px', padding: 18, gap: 10 }}>
          <span className="card-title" style={{ padding: '0 4px' }}>Right now</span>
          {data.live.map((t) => (
            <div key={t.init} className="tile white">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="avatar" style={{ width: 38, height: 38, background: t.state === 'free' ? '#BFD0E0' : STATE_BG[t.state] }} aria-hidden="true">{t.init}</span>
                <div className="stack" style={{ flex: 1, '--gap': '0px' }}><span className="bold">{t.name} · {t.job}</span><span className="small muted-2">{t.where}</span></div>
                <span className="small bold">{t.time}</span>
              </div>
              <div className="steps-bars" role="img" aria-label={t.step_text}>
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={i < t.step ? 'on' : ''} />)}
              </div>
              <span className="small muted-2">{t.step_text}</span>
            </div>
          ))}
        </section>
      </div>

      <section aria-label="Work efficiency" className="card soft" style={{ padding: 20, gap: 16 }}>
        <div className="between wrap">
          <span className="card-title">Work efficiency · this {period.toLowerCase()}</span>
          <Pills label="Period" options={['Week', 'Month']} value={period} onChange={setPeriod} />
        </div>
        <div className="grid-auto" style={{ '--min': '180px', gap: 12 }}>
          {data.kpis.map((k) => (
            <div key={k.label} className="stack" style={{ background: 'var(--soft-2)', borderRadius: 18, padding: 14, '--gap': '2px' }}>
              <span className="small muted">{k.label}</span><span style={{ fontSize: 28, fontWeight: 600 }}>{k.value}</span><span className="xs muted">{k.note}</span>
            </div>
          ))}
        </div>
        <div className="table-wrap" style={{ background: 'var(--mint)', borderRadius: 20, padding: '6px 14px' }}>
          <table className="table light" style={{ minWidth: 760 }}>
            <thead><tr><th>Technician</th><th className="r">Jobs</th><th className="r">Avg time on site</th><th className="r">Fixed first visit</th><th className="r">Quotes approved</th><th className="r">To centre</th><th className="r">Travel</th><th className="r">Rating</th></tr></thead>
            <tbody>
              {data.efficiency.map((e) => (
                <tr key={e.name}>
                  <td className="bold">{e.name}</td><td className="r">{e.jobs}</td><td className="r">{e.avg}</td><td className="r">{e.ftf}</td>
                  <td className="r">{e.quote}</td><td className="r">{e.centre}</td><td className="r">{e.km}</td><td className="r">{e.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
