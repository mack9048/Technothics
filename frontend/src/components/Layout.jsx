import { Link, NavLink, Outlet } from 'react-router-dom';
import Icon from './Icon';
import { Logo } from './ui';

const NAV = [
  ['/', 'Dashboard'],
  ['/production', 'Production'],
  ['/service', 'Service'],
  ['/field', 'Field'],
  ['/inventory', 'Inventory'],
  ['/accounts', 'Accounts'],
  ['/hr', 'HR'],
];

export default function Layout() {
  return (
    <div className="app-bg">
      <div className="app-frame">
        <header className="header">
          <Link to="/" className="brand" aria-label="Technothics home">
            <Logo />
            <span className="brand-text"><span className="brand-name">Technothics</span><span className="brand-tag">Redefining Technologies</span></span>
          </Link>
          <nav aria-label="Main" className="nav">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : undefined)}>{label}</NavLink>
            ))}
          </nav>
          <div className="header-right">
            <button className="icon-btn lg" aria-label="Notifications"><Icon name="bell" /></button>
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">SC</span>
              <span className="user-chip-text"><b>Service Coordinator</b><span>Call desk</span></span>
            </div>
          </div>
        </header>
        <Outlet />
      </div>
      <div className="footer-links">
        <span>Technician app:</span>
        <Link to="/tech">My jobs</Link>
        <Link to="/tech/onsite/SR-1046">On-site flow</Link>
      </div>
    </div>
  );
}
