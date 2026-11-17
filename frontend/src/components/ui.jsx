import { DEMO } from '../lib/api';
import { inr } from '../lib/format';

export function Logo({ size = 44 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 44 44">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22C3C3" />
          <stop offset="1" stopColor="#3A2FA8" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill="url(#tg)" />
      <g fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 9v11l-3 4v9" /><path d="M12 20v8l4 4" /><path d="M32 20v8l-4 4" />
      </g>
      <g fill="#22B5C4">
        <circle cx="22" cy="10" r="1.6" /><circle cx="12" cy="20" r="1.6" /><circle cx="32" cy="20" r="1.6" /><circle cx="19" cy="31" r="1.6" />
      </g>
    </svg>
  );
}

/** Rupee amount with the small raised ₹ used throughout the design. */
export function Money({ value, decimals = 0 }) {
  const n = Number(value) || 0;
  return <>{n < 0 ? '− ' : ''}<span className="rupee">₹</span>{inr(Math.abs(n), decimals)}</>;
}

export function Stat({ label, children, style }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={style}>{children}</span>
    </div>
  );
}

export function Ring({ pct, label }) {
  const c = 2 * Math.PI * 48;
  return (
    <div className="ring-wrap">
      <svg role="img" aria-label={`${pct}% ${label}`} width="64" height="64" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#E6EEF6" strokeWidth="14" />
        <circle cx="60" cy="60" r="48" fill="none" stroke="#0B1026" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
        <text x="60" y="66" textAnchor="middle" fontSize="28" fontWeight="700" fill="#0B1026" fontFamily="Urbanist, sans-serif">{pct}%</text>
      </svg>
      <span>{label}</span>
    </div>
  );
}

/** Date / "Sample data" chip at the top of each page. */
export function PageChip({ children }) {
  return <span className={'chip' + (DEMO ? ' demo' : '')}>{children}{DEMO ? ' · Demo data' : ''}</span>;
}

export function Pills({ options, value, onChange, label, size, variant }) {
  return (
    <div role="group" aria-label={label} className="pills">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
          className={['pill', size, variant].filter(Boolean).join(' ')}>{o}</button>
      ))}
    </div>
  );
}

export function Bar({ pct, color, className = '' }) {
  return <div className={'bar ' + className}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>;
}

export function Toast({ msg }) {
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="between"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function Loading({ error, onRetry }) {
  if (error) {
    return (
      <div className="skeleton">
        <div className="stack" style={{ alignItems: 'center' }}>
          <div className="error-box">Could not load: {error}</div>
          {onRetry && <button className="btn outline" onClick={onRetry}>Try again</button>}
        </div>
      </div>
    );
  }
  return <div className="skeleton" aria-busy="true">Loading…</div>;
}
