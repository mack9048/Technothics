import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Accounts from './pages/Accounts';
import Dashboard from './pages/Dashboard';
import Field from './pages/Field';
import HR from './pages/HR';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Profitability from './pages/Profitability';
import Service from './pages/Service';
import Jobs from './tech/Jobs';
import OnSite from './tech/OnSite';
import TechInvoice from './tech/TechInvoice';
import TechJob from './tech/TechJob';
import TechShell from './tech/TechShell';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="production" element={<Production />} />
        <Route path="service" element={<Service />} />
        <Route path="field" element={<Field />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="accounts/profitability" element={<Profitability />} />
        <Route path="hr" element={<HR />} />
      </Route>
      <Route path="tech" element={<TechShell />}>
        <Route index element={<Jobs />} />
        <Route path="job/:code" element={<TechJob />} />
        <Route path="job/:code/invoice" element={<TechInvoice />} />
        <Route path="onsite/:code" element={<OnSite />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
