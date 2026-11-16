import { Linking } from 'react-native';
import { navigateWhenReady } from '../navigation/navigationRef';
import { getStoreBySlug } from '../api/stores.api';

/**
 * One place that knows where a link, a banner or a notification goes.
 *   ukmarketplace://store/<slug>       a store
 *   ukmarketplace://product/<id>       a product
 *   ukmarketplace://coupon/<CODE>      add a code to the basket
 * Banners use the same targets: { type: store|category|coupon|url, value }.
 */
export const parseLink = (url) => {
  const m = String(url || '').match(/^ukmarketplace:\/\/\/?(store|product|coupon)\/([^/?#]+)/i);
  if (!m) return null;
  return { type: m[1].toLowerCase(), value: decodeURIComponent(m[2]) };
};

/**
 * @param {{type: string, value: string}} target
 * @param {{ applyCoupon?: (code: string) => Promise<{success, message, error}>, onMessage?: (title, text) => void }} deps
 */
export const openTarget = async (target, { applyCoupon, onMessage } = {}) => {
  if (!target?.type || target.type === 'none') return;
  try {
    if (target.type === 'store') {
      const res = await getStoreBySlug(target.value);
      const store = res?.data ?? res;
      if (store) {
        navigateWhenReady('MainTabs', { screen: 'ShopHomeTab', params: { screen: 'StoreCategories', params: { store }, initial: false } });
      }
    } else if (target.type === 'product') {
      navigateWhenReady('ProductDetail', { product: { _id: target.value } });
    } else if (target.type === 'coupon' && applyCoupon) {
      const res = await applyCoupon(target.value);
      onMessage?.(res.success ? 'Code added' : "Couldn't add that code", res.success ? res.message : res.error);
      if (res.success) navigateWhenReady('MainTabs', { screen: 'BasketTab' });
    } else if (target.type === 'url' && /^https:\/\//.test(target.value)) {
      await Linking.openURL(target.value);
    } else if (target.type === 'category') {
      navigateWhenReady('MainTabs', { screen: 'ShopHomeTab', params: { screen: 'ShopHome', params: { category: target.value } } });
    }
  } catch {
    onMessage?.('Something went wrong', "We couldn't open that. Please try again.");
  }
};
