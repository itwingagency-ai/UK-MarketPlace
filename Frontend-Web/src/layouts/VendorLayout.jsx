import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { LiveOrdersProvider } from '../context/LiveOrdersContext';
import TopHeader from '../components/common/TopHeader';

export default function VendorLayout() {
  return (
    <LiveOrdersProvider role="vendor">
      <div className="app-layout">
        <Sidebar role="vendor" />
        <div className="main-content">
          <TopHeader />
          <main className="page-content animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </LiveOrdersProvider>
  );
}
