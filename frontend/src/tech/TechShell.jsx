import { Outlet } from 'react-router-dom';

/** Phone-sized frame on desktop, full screen on phones. */
export default function TechShell() {
  return (
    <div className="phone-bg">
      <div className="phone"><Outlet /></div>
    </div>
  );
}
