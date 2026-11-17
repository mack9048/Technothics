import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Loading } from '../components/ui';
import { DEMO } from '../lib/api';
import { useApi } from '../lib/hooks';

const TAG_BG = { 'Multi-brand': 'var(--peach)', Warranty: 'var(--teal)', Chargeable: 'var(--mint)' };

export default function Jobs() {
  const { data, error, reload } = useApi('/tech/jobs');
  if (!data) return <Loading error={error} onRetry={reload} />;
  return (
    <div className="phone-body">
      <div className="phone-nav">
        <Link to="/" aria-label="Back to office app" className="icon-btn"><Icon name="back" /></Link>
        <span style={{ fontSize: 17, fontWeight: 700 }}>My jobs</span>
        <span className="badge dark">{data.jobs.length} open</span>
      </div>
      {DEMO && <span className="chip demo">Demo data</span>}
      {data.jobs.map((j) => (
        <Link key={j.code} to={j.code === 'SR-1046' ? `/tech/onsite/${j.code}` : `/tech/job/${j.code}`} className="card mint" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
          <div className="between"><span className="bold">{j.code} · {j.customer}</span><span className="badge" style={{ background: TAG_BG[j.tag] }}>{j.tag}</span></div>
          <span className="small muted-2">{j.product}{j.address ? ` · ${j.address}` : ''}</span>
          <div className="between"><span className="small">{j.stage} · {j.tech}</span><Icon name="chev" size={16} /></div>
        </Link>
      ))}
    </div>
  );
}
