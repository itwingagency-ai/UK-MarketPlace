import { vendorService } from '../../api/vendorService';
import OffersPage from '../shared/OffersPage';

const loadProducts = async () => {
  const res = await vendorService.getProducts({ limit: 100 });
  return res?.data || [];
};

export default function VendorOffersPage() {
  return <OffersPage role="vendor" service={vendorService} loadProducts={loadProducts} />;
}
