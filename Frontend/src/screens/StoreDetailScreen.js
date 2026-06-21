import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStoreProducts } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const { width } = Dimensions.get('window');
const PRODUCT_CARD_W = (width - Spacing['2xl'] * 2 - Spacing.md) / 2;

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const priceInPounds = (product.price / 100).toFixed(2);
  const comparePriceInPounds = product.compareAtPrice
    ? (product.compareAtPrice / 100).toFixed(2)
    : null;
  const hasDiscount = comparePriceInPounds && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={productStyles.card}
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Image placeholder */}
        <View style={productStyles.imgWrapper}>
          <Text style={productStyles.imgEmoji}>
            {getCategoryEmoji(product.category?.slug)}
          </Text>
          {hasDiscount && (
            <View style={productStyles.discountBadge}>
              <Text style={productStyles.discountText}>-{discountPct}%</Text>
            </View>
          )}
          {product.stock === 0 && (
            <View style={productStyles.outOfStockOverlay}>
              <Text style={productStyles.outOfStockText}>Out of stock</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={productStyles.info}>
          {product.category?.name && (
            <Text style={productStyles.categoryLabel} numberOfLines={1}>
              {product.category.name}
            </Text>
          )}
          <Text style={productStyles.productName} numberOfLines={2}>
            {product.title}
          </Text>

          {/* Rating */}
          {product.ratingCount > 0 && (
            <View style={productStyles.ratingRow}>
              <Text style={productStyles.ratingStar}>★</Text>
              <Text style={productStyles.ratingVal}>
                {product.averageRating?.toFixed(1)} ({product.ratingCount})
              </Text>
            </View>
          )}

          {/* Price row */}
          <View style={productStyles.priceRow}>
            <Text style={productStyles.price}>£{priceInPounds}</Text>
            {hasDiscount && (
              <Text style={productStyles.comparePrice}>£{comparePriceInPounds}</Text>
            )}
          </View>
        </View>

        {/* Add to basket */}
        <TouchableOpacity style={productStyles.addBtn} activeOpacity={0.85}>
          <Text style={productStyles.addBtnText}>+</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Store Header ─────────────────────────────────────────────────────────────

function StoreHeader({ store, onBack }) {
  const isOpen = store.isOpen ?? store.status === 'open';
  const address = [store.address?.line1, store.address?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={headerStyles.container}>
      {/* Top row */}
      <View style={headerStyles.topRow}>
        <TouchableOpacity style={headerStyles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={headerStyles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={headerStyles.storeIconWrapper}>
          <Text style={headerStyles.storeIcon}>🏪</Text>
        </View>
        <View style={headerStyles.topInfo}>
          <Text style={headerStyles.storeName} numberOfLines={1}>{store.name}</Text>
          {address ? (
            <Text style={headerStyles.storeAddress} numberOfLines={1}>{address}</Text>
          ) : null}
        </View>
        <View style={[headerStyles.statusBadge, isOpen ? headerStyles.statusOpen : headerStyles.statusClosed]}>
          <View style={[headerStyles.statusDot, isOpen ? headerStyles.dotOpen : headerStyles.dotClosed]} />
          <Text style={[headerStyles.statusText, isOpen ? headerStyles.statusOpenText : headerStyles.statusClosedText]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>

      {/* Meta pills */}
      <View style={headerStyles.metaRow}>
        {store.deliveryRadiusKm != null && (
          <View style={headerStyles.metaPill}>
            <Text style={headerStyles.metaPillText}>🚐 {store.deliveryRadiusKm} km delivery zone</Text>
          </View>
        )}
        {store.distanceKm != null && (
          <View style={headerStyles.metaPill}>
            <Text style={headerStyles.metaPillText}>📍 {store.distanceKm.toFixed(1)} km away</Text>
          </View>
        )}
        {store.todayHours && !store.todayHours.isClosed && (
          <View style={headerStyles.metaPill}>
            <Text style={headerStyles.metaPillText}>
              🕐 {store.todayHours.open} – {store.todayHours.close}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Empty / Error States ─────────────────────────────────────────────────────

function EmptyProducts({ storeName }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🛒</Text>
      <Text style={styles.emptyTitle}>No products listed yet</Text>
      <Text style={styles.emptySub}>
        {storeName} hasn't added any products yet. Check back soon!
      </Text>
    </View>
  );
}

function ErrorState({ onRetry }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>⚠️</Text>
      <Text style={styles.emptyTitle}>Couldn't load products</Text>
      <Text style={styles.emptySub}>Check your connection and try again.</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.retryBtnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StoreDetailScreen({ route, navigation }) {
  const { store } = route.params ?? {};

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState([{ id: 'all', label: 'All' }]);

  const storeSlug = store?.slug;

  // ── Fetch products ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (opts = {}) => {
    const { pageNum = 1, isRefresh = false, catFilter = activeCategory } = opts;

    if (!storeSlug) {
      setError(true);
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    setError(false);

    try {
      const params = { page: pageNum, limit: 20 };
      if (catFilter !== 'all') params.category = catFilter;

      const data = await getStoreProducts(storeSlug, params);
      const fetched = data?.data?.products ?? data?.products ?? [];
      const fetchedTotal = data?.data?.total ?? data?.total ?? 0;
      const fetchedLimit = data?.data?.limit ?? 20;

      setTotal(fetchedTotal);

      if (pageNum === 1) {
        setProducts(fetched);
        // Extract unique categories from products for filter pills
        const seen = new Set();
        const cats = [{ id: 'all', label: 'All' }];
        fetched.forEach((p) => {
          if (p.category && !seen.has(p.category.slug)) {
            seen.add(p.category.slug);
            cats.push({ id: p.category.slug, label: p.category.name });
          }
        });
        if (cats.length > 1) setCategories(cats);
      } else {
        setProducts((prev) => [...prev, ...fetched]);
      }

      setHasMore(pageNum * fetchedLimit < fetchedTotal);
      setPage(pageNum);
    } catch (err) {
      if (pageNum === 1) setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [storeSlug, activeCategory]);

  useEffect(() => {
    fetchProducts({ pageNum: 1 });
  }, [storeSlug]);

  const handleRefresh = () => fetchProducts({ pageNum: 1, isRefresh: true });

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      fetchProducts({ pageNum: page + 1 });
    }
  };

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    setProducts([]);
    setPage(1);
    fetchProducts({ pageNum: 1, catFilter: catId });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderProduct = useCallback(({ item }) => (
    <ProductCard product={item} />
  ), []);

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 80 }} />;
    return (
      <View style={styles.loadMoreIndicator}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadMoreText}>Loading more…</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Category filter pills */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catFilterRow}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
              onPress={() => handleCategoryChange(cat.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.catChipText, activeCategory === cat.id && styles.catChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Results count */}
      {!loading && (
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            {total > 0 ? `${total} product${total !== 1 ? 's' : ''}` : 'No products'}
            {activeCategory !== 'all' ? ' in this category' : ''}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StoreHeader store={store} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading products from {store?.name}…</Text>
        </View>
      ) : error ? (
        <ErrorState onRetry={() => fetchProducts({ pageNum: 1 })} />
      ) : products.length === 0 ? (
        <EmptyProducts storeName={store?.name} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, i) => item._id ?? item.id ?? String(i)}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productList}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryEmoji(slug) {
  const map = {
    'fruit-veg': '🍎', fruit: '🍎', vegetables: '🥦',
    drinks: '🥤', beverages: '🥤',
    bakery: '🥐', bread: '🍞',
    frozen: '❄️',
    snacks: '🍿', crisps: '🍟',
    alcohol: '🍺', beer: '🍺', wine: '🍷', spirits: '🥃',
    dairy: '🥛', milk: '🥛', cheese: '🧀',
    meat: '🥩', poultry: '🍗',
    household: '🧹', cleaning: '🧴',
    personal: '🧴', health: '💊',
    confectionery: '🍫', chocolate: '🍫', sweets: '🍬',
  };
  return slug ? (map[slug] || '🛒') : '🛒';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  safeArea: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },

  // Loading
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: Typography.size.sm, color: Colors.muted, fontWeight: Typography.weight.medium },

  // Category filter row
  catFilterRow: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.textSecondary },
  catChipTextActive: { color: Colors.white },

  // Results count
  resultsRow: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.sm },
  resultsText: { fontSize: Typography.size.xs, color: Colors.muted, fontWeight: Typography.weight.medium },

  // Products grid
  productList: { paddingHorizontal: Spacing['2xl'], paddingBottom: Spacing['3xl'] },
  columnWrapper: { justifyContent: 'space-between', marginBottom: Spacing.md },

  // Load more
  loadMoreIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  loadMoreText: { fontSize: Typography.size.sm, color: Colors.muted, fontWeight: Typography.weight.medium },

  // Empty / Error
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'] },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  emptySub: { fontSize: Typography.size.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing['2xl'] },
  retryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 14, paddingHorizontal: Spacing['3xl'],
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  retryBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.white },
});

// ─── Store Header Styles ──────────────────────────────────────────────────────

const headerStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  backIcon: { fontSize: 20, color: Colors.text, fontWeight: '600', lineHeight: 22 },
  storeIconWrapper: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  storeIcon: { fontSize: 24 },
  topInfo: { flex: 1 },
  storeName: { fontSize: Typography.size.md, fontWeight: Typography.weight.extrabold, color: Colors.text, letterSpacing: -0.3 },
  storeAddress: { fontSize: Typography.size.xs, color: Colors.muted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, gap: 5, alignSelf: 'flex-start',
  },
  statusOpen: { backgroundColor: '#DCFCE7' },
  statusClosed: { backgroundColor: Colors.surfaceSecondary },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  dotOpen: { backgroundColor: '#16A34A' },
  dotClosed: { backgroundColor: Colors.muted },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusOpenText: { color: '#16A34A' },
  statusClosedText: { color: Colors.muted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  metaPillText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
});

// ─── Product Card Styles ──────────────────────────────────────────────────────

const productStyles = StyleSheet.create({
  card: {
    width: PRODUCT_CARD_W,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  imgWrapper: {
    height: 130,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imgEmoji: { fontSize: 52 },
  discountBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  discountText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  outOfStockOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  outOfStockText: { fontSize: 11, fontWeight: '700', color: Colors.muted },
  info: { padding: Spacing.md, paddingBottom: 6 },
  categoryLabel: {
    fontSize: 9, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
  },
  productName: {
    fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold,
    color: Colors.text, lineHeight: 18, marginBottom: 4,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  ratingStar: { fontSize: 11, color: '#F59E0B' },
  ratingVal: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold, color: Colors.text },
  comparePrice: {
    fontSize: Typography.size.xs, color: Colors.muted,
    textDecorationLine: 'line-through', fontWeight: Typography.weight.medium,
  },
  addBtn: {
    margin: Spacing.md, marginTop: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  addBtnText: { fontSize: 20, fontWeight: '700', color: Colors.white, lineHeight: 22 },
});
