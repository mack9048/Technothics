import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Loading, Modal, Money, PageChip, Pills, Stat, Toast } from '../components/ui';
import { api } from '../lib/api';
import { useApi, useToast } from '../lib/hooks';
import { pad2, rs } from '../lib/format';

const PUNCH_BG = { Present: 'var(--teal)', Late: 'var(--peach)', Leave: 'var(--mint)' };

export default function HR() {
  const { data, error, reload, mutate } = useApi('/hr');
  const [tab, setTab] = useState('Overview');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, showToast] = useToast();

  const staff = useMemo(() => {
    if (!data) return [];
    const n = q.trim().toLowerCase();
    return n ? data.staff.filter((s) => [s.name, s.role, s.phone, s.dept].some((v) => v && v.toLowerCase().includes(n))) : data.staff;
  }, [data, q]);

  if (!data) return <Loading error={error} onRetry={reload} />;
  const s = data.stats;

  async function decide(leave, status) {
    try {
      const res = await api.patch(`/hr/leaves/${leave.id}`, { status });
      mutate((d) => ({ ...d, leaves: d.leaves.filter((l) => l.id !== leave.id) }));
      showToast(`${leave.label}: ${status}` + (res.demo ? ' (demo — not saved)' : ''));
    } catch (e) {
      showToast(e.message);
    }
  }

  return (
    <>
      <section className="page-head">
        <div className="page-title"><PageChip>{data.date}</PageChip><h1>People &amp; HR</h1></div>
        <div className="stats">
          <Stat label="Employees">{s.employees}</Stat>
          <Stat label="Present today">{s.present}</Stat>
          <Stat label="On leave">{pad2(s.on_leave)}</Stat>
          <Stat label={`Payroll · ${s.payroll_month.slice(0, 3)}`}><Money value={s.payroll_total} /></Stat>
        </div>
      </section>

      <div className="toolbar">
        <Pills label="HR section" options={['Overview', 'Directory', 'Attendance', 'Leave', 'Payroll', 'Documents']} value={tab} onChange={setTab} />
        <button className="btn sm teal" onClick={() => setAdding(true)}>+ Add employee</button>
      </div>

      <div className="row">
        <section aria-label="Attendance today" className="card dark col-main" style={{ gap: 16, padding: 22 }}>
          <div className="card-head">
            <div className="stack" style={{ '--gap': '0px' }}>
              <span className="card-title">Attendance today</span>
              <span className="card-sub">Factory &amp; office: face / biometric · Technicians: app check-in with GPS</span>
            </div>
            <span className="small dim">Shift {data.shift}</span>
          </div>
          <div className="grid-auto" style={{ '--min': '150px', gap: 10 }}>
            {data.depts.map((d) => (
              <div key={d.name} className="stack" style={{ background: 'var(--ink-2)', borderRadius: 18, padding: '12px 14px', '--gap': '6px' }}>
                <span className="semi" style={{ fontSize: 14 }}>{d.name}</span>
                <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{d.present}<span style={{ fontSize: 14, color: 'var(--on-dark-muted)' }}> / {d.total}</span></span>
                <Bar pct={(d.present / d.total) * 100} className="thin6" />
              </div>
            ))}
          </div>
          <div>
            {data.punches.map((a) => (
              <div key={a.name} className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--ink-2)', padding: '10px 0' }}>
                <span className="avatar" style={{ width: 34, height: 34, fontSize: 13 }} aria-hidden="true">{a.init}</span>
                <span className="stack" style={{ flex: '1 1 160px', '--gap': '0px' }}><span className="semi">{a.name}</span><span className="small" style={{ color: 'var(--on-dark-muted)' }}>{a.role}</span></span>
                <span className="small dim" style={{ minWidth: 150 }}>{a.how}</span>
                <span style={{ fontSize: 14, minWidth: 70 }}>{a.time}</span>
                <span className="badge" style={{ background: PUNCH_BG[a.status], minWidth: 64, textAlign: 'center' }}>{a.status}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="col-side">
          <section aria-label="Leave requests" className="card mint" style={{ padding: 20 }}>
            <div className="between"><span className="card-title">Leave requests</span><span className="badge peach">{data.leaves.length} pending</span></div>
            {data.leaves.length === 0 && <span className="small muted-2">All caught up.</span>}
            {data.leaves.map((l) => (
              <div key={l.id} className="tile white" style={{ padding: 12 }}>
                <div className="between"><span className="bold">{l.label}</span><span className="small muted-2">{l.type}</span></div>
                <span className="small muted-2">{l.dates} · balance {l.balance}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn dark flex1" style={{ height: 40 }} onClick={() => decide(l, 'approved')}>Approve</button>
                  <button className="btn outline flex1" style={{ height: 40 }} onClick={() => decide(l, 'rejected')}>Reject</button>
                </div>
              </div>
            ))}
          </section>

          <section aria-label="Payroll" className="card teal" style={{ padding: 20, gap: 10 }}>
            <span className="card-title">Payroll · {s.payroll_month}</span>
            {data.payroll.map((r) => <div key={r.label} className="kv"><span>{r.label}</span><span className="semi">{rs(r.amount)}</span></div>)}
            <span className="small">Attendance locks on 30 Nov. Payslips go out on WhatsApp; salary posts to Accounts automatically.</span>
            <button className="btn dark" onClick={() => showToast('Payroll preview: coming soon')}>Preview payroll</button>
          </section>
        </div>
      </div>

      <div className="row">
        <section aria-label="Employee directory" className="card mint col-main" style={{ padding: 20 }}>
          <div className="between wrap">
            <span className="card-title">Employee directory</span>
            <label htmlFor="esearch" className="sr-only">Search employees</label>
            <input id="esearch" className="input round" style={{ width: 260 }} placeholder="Search name, role, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table className="table light" style={{ minWidth: 720 }}>
              <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Joined</th><th>Pay type</th><th>App access</th></tr></thead>
              <tbody>
                {staff.map((e) => (
                  <tr key={e.id ?? e.name}>
                    <td className="bold">{e.name}</td><td>{e.role}</td><td className="muted-2">{e.dept}</td><td className="muted-2">{e.joined}</td><td>{e.pay_type}</td><td className="muted-2">{e.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="col-side">
          <section aria-label="Incentives" className="card soft" style={{ padding: 20, gap: 10 }}>
            <span className="card-title">Incentives · linked to work</span>
            {data.incentives.map((i) => (
              <div key={i.label} className="kv" style={{ background: 'var(--soft-2)', borderRadius: 14, padding: '10px 12px' }}><span>{i.label}</span><span className="semi">{rs(i.amount)}</span></div>
            ))}
            <Link to="/field" className="semi" style={{ fontSize: 14 }}>See technician efficiency</Link>
          </section>
          <section aria-label="Documents" className="card soft" style={{ padding: 20, gap: 10 }}>
            <span className="card-title">Documents expiring</span>
            {data.documents.map((d) => <div key={d.label} className="kv"><span>{d.label}</span><span className="semi">{d.due}</span></div>)}
          </section>
        </div>
      </div>

      {adding && (
        <AddEmployee onClose={() => setAdding(false)} onSaved={(emp, demo) => {
          mutate((d) => ({ ...d, staff: [...d.staff, emp] }));
          setAdding(false);
          showToast(`${emp.name} added` + (demo ? ' (demo — not saved)' : ''));
        }} onError={showToast} />
      )}
      <Toast msg={toast} />
    </>
  );
}

function AddEmployee({ onClose, onSaved, onError }) {
  const [f, setF] = useState({ name: '', role: '', dept: 'Production', pay_type: 'Monthly', access: 'None', phone: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    try {
      const res = await api.post('/hr/employees', f);
      onSaved(res.employee || { ...f, joined: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) }, res.demo);
    } catch (err) {
      onError(err.message);
    }
  }
  return (
    <Modal title="Add employee" onClose={onClose}>
      <form className="stack" style={{ '--gap': '12px' }} onSubmit={submit}>
        <div className="field"><label className="label" htmlFor="ename">Name</label><input id="ename" className="input" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label className="label" htmlFor="erole">Role</label><input id="erole" className="input" required value={f.role} onChange={set('role')} /></div>
        <div className="field">
          <label className="label" htmlFor="edept">Department</label>
          <select id="edept" className="input" value={f.dept} onChange={set('dept')}>{['Production', 'Service', 'Office', 'Store', 'Sales'].map((d) => <option key={d}>{d}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="epay">Pay type</label><input id="epay" className="input" value={f.pay_type} onChange={set('pay_type')} /></div>
        <div className="field"><label className="label" htmlFor="ephone">Phone</label><input id="ephone" className="input" type="tel" value={f.phone} onChange={set('phone')} /></div>
        <button className="btn lg dark">Save employee</button>
      </form>
    </Modal>
  );
}
