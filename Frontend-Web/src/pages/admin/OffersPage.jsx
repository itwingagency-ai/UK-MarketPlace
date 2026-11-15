import { adminService } from '../../api/adminService';
import OffersPage from '../shared/OffersPage';

const loadStores = async () => {
  const res = await adminService.getStores({ page: 1, limit: 100 });
  return res?.data || [];
};

export default function AdminOffersPage() {
  return <OffersPage role="admin" service={adminService} loadStores={loadStores} />;
}
