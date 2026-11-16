import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import { LiveOrdersProvider } from '../context/LiveOrdersContext';
import TopHeader from '../components/common/TopHeader';

export default function AdminLayout() {
  return (
    <LiveOrdersProvider role="admin">
      <div className="app-layout">
        <Sidebar role="admin" />
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
