/**
 * Registry of pre-rendered 3D assets (transparent PNG/WebP).
 *
 * File names follow arbaz-design/11-storefront-3d-assets/asset-list.md.
 * When a render is added to this folder, register it here, e.g.
 *   'cat-bakery': require('./cat-bakery.png'),
 * Unregistered names fall back to a tinted morphic tile with an icon
 * (see components/Asset3D.js), so screens never show a broken image.
 */
const ASSETS = {
  'badge-key-reset': require('./badge-key-reset.png'),
  'badge-otp-shield': require('./badge-otp-shield.png'),
  'badge-promo-star': require('./badge-promo-star.png'),
  'badge-scooter-refresh': require('./badge-scooter-refresh.png'),
  'cat-alcohol': require('./cat-alcohol.png'),
  'cat-baby': require('./cat-baby.png'),
  'cat-bakery': require('./cat-bakery.png'),
  'cat-breakfast': require('./cat-breakfast.png'),
  'cat-dairy-eggs': require('./cat-dairy-eggs.png'),
  'cat-drinks': require('./cat-drinks.png'),
  'cat-electronics': require('./cat-electronics.png'),
  'cat-flowers': require('./cat-flowers.png'),
  'cat-frozen': require('./cat-frozen.png'),
  'cat-fruit-veg': require('./cat-fruit-veg.png'),
  'cat-halal': require('./cat-halal.png'),
  'cat-health-beauty': require('./cat-health-beauty.png'),
  'cat-household': require('./cat-household.png'),
  'cat-meat-fish': require('./cat-meat-fish.png'),
  'cat-off-licence': require('./cat-off-licence.png'),
  'cat-pet': require('./cat-pet.png'),
  'cat-pharmacy': require('./cat-pharmacy.png'),
  'cat-ready-meals': require('./cat-ready-meals.png'),
  'cat-snacks-sweets': require('./cat-snacks-sweets.png'),
  'cat-stationery': require('./cat-stationery.png'),
  'cat-tea-coffee': require('./cat-tea-coffee.png'),
  'cat-tinned-cupboard': require('./cat-tinned-cupboard.png'),
  'cat-vegan': require('./cat-vegan.png'),
  'cat-world-foods': require('./cat-world-foods.png'),
  'hero-delivery-scooter': require('./hero-delivery-scooter.png'),
  'hero-storefront': require('./hero-storefront.png'),
  'illo-application-review': require('./illo-application-review.png'),
  'illo-empty-basket': require('./illo-empty-basket.png'),
  'illo-empty-catalogue': require('./illo-empty-catalogue.png'),
  'illo-empty-favourites': require('./illo-empty-favourites.png'),
  'illo-empty-notifications': require('./illo-empty-notifications.png'),
  'illo-error-403': require('./illo-error-403.png'),
  'illo-error-404': require('./illo-error-404.png'),
  'illo-error-cone': require('./illo-error-cone.png'),
  'illo-no-stores': require('./illo-no-stores.png'),
  'illo-order-success': require('./illo-order-success.png'),
  'illo-search-empty': require('./illo-search-empty.png'),
  'illo-session-expired': require('./illo-session-expired.png'),
};

export default ASSETS;
