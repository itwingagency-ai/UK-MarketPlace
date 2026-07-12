import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  TextInput,
  Platform,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getNearbyStores } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const { width } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 70;

// ─── Simple Search Icon (pure View) ──────────────────────────────────────────

function SearchIcon({ size = 16, color = Colors.muted }) {
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View
        style={{
          width: size * 0.65,
          height: size * 0.65,
          borderRadius: size * 0.325,
          borderWidth: 2,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: size * 0.38,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

// ─── Store Banner (Foodpanda Style) ───────────────────────────────────────────

const DEFAULT_STORE_IMAGE = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=800&auto=format&fit=crop';

function StoreBanner({ store, onPress }) {
  const imageUrl = store.branding?.bannerUrl || store.logoUrl || store.imageUrl || DEFAULT_STORE_IMAGE;

  // Build rating display — use exact data from backend or fallback to 0
  const rating = store.averageRating ?? 0;
  const ratingCount = store.ratingCount ?? 0;
  const ratingDisplay = rating > 0 ? Number(rating).toFixed(1) : '0';

  // Delivery time estimate (from shipping methods if available, else derive from distance)
  const deliveryTime = store.deliveryTime
    || (store.distanceKm != null
      ? `From ${Math.max(10, Math.round(store.distanceKm * 5))} min`
      : 'From 15 min');

  // Delivery fee
  const deliveryFee = store.deliveryFee ?? store.shippingFee ?? null;

  // Category / type label
  const categoryLabel = store.category || store.storeType || 'Grocery';

  let closedText = null;
  if (store.isOpen === false) {
    if (store.nextOpenDay && store.nextOpenTime) {
      if (store.nextOpenDay === 'Today' || store.nextOpenDay === 'Tomorrow') {
        closedText = `Opens at ${store.nextOpenTime}`;
      } else {
        closedText = `Opens at ${store.nextOpenDay}, ${store.nextOpenTime}`;
      }
    } else {
      closedText = 'Currently Closed';
    }
  }

  return (
    <TouchableOpacity
      style={bannerStyles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* ── Banner Image ── */}
      <View style={bannerStyles.imageContainer}>
        <ImageBackground
          source={{ uri: imageUrl }}
          style={bannerStyles.bgImage}
          imageStyle={bannerStyles.imageRounded}
        >
          {/* Carousel dots (visual only) */}
          <View style={bannerStyles.dotsRow}>
            <View style={[bannerStyles.dot, bannerStyles.dotActive]} />
            <View style={bannerStyles.dot} />
            <View style={bannerStyles.dot} />
            <View style={bannerStyles.dot} />
          </View>

          {/* Closed Overlay (rendered last to cover dots) */}
          {store.isOpen === false && closedText && (
            <View style={bannerStyles.closedOverlay}>
              <Text style={bannerStyles.closedText}>{closedText}</Text>
            </View>
          )}
        </ImageBackground>
      </View>

      {/* ── Store Info Section ── */}
      <View style={bannerStyles.infoSection}>
        {/* Row 1: Store name + Rating */}
        <View style={bannerStyles.nameRow}>
          <Text style={bannerStyles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          <View style={bannerStyles.ratingBadge}>
            <Text style={bannerStyles.ratingStar}>⭐</Text>
            <Text style={bannerStyles.ratingValue}>{ratingDisplay}</Text>
            <Text style={bannerStyles.ratingCount}>({ratingCount})</Text>
          </View>
        </View>

        {/* Row 2: Delivery time · distance · category */}
        <Text style={bannerStyles.metaText} numberOfLines={1}>
          {deliveryTime}
          {store.distanceKm != null ? ` · ${store.distanceKm.toFixed(1)} km` : ''}
          {` · ${categoryLabel}`}
        </Text>

        {/* Row 3: Delivery charges */}
        {deliveryFee != null ? (
          <View style={bannerStyles.deliveryRow}>
            <Text style={bannerStyles.bikeIcon}>🛵</Text>
            <Text style={bannerStyles.deliveryFee}>£{Number(deliveryFee).toFixed(2)}</Text>
          </View>
        ) : store.deliveryRadiusKm != null ? (
          <View style={bannerStyles.deliveryRow}>
            <Text style={bannerStyles.bikeIcon}>🛵</Text>
            <Text style={bannerStyles.deliveryFee}>Free delivery</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty / Error / Loading states ──────────────────────────────────────────

function LoadingState({ postcode }) {
  return (
    <View style={styles.centeredState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.stateTitle}>Finding stores…</Text>
      <Text style={styles.stateSub}>Looking for stores near {postcode}</Text>
    </View>
  );
}

function EmptyState({ postcode, onRefresh }) {
  return (
    <View style={styles.centeredState}>
      <Text style={styles.stateEmoji}>🏪</Text>
      <Text style={styles.stateTitle}>No stores found</Text>
      <Text style={styles.stateSub}>
        No stores currently deliver to{'\n'}{postcode}
      </Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.85}>
        <Text style={styles.retryBtnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorState({ onRetry }) {
  return (
    <View style={styles.centeredState}>
      <Text style={styles.stateEmoji}>⚠️</Text>
      <Text style={styles.stateTitle}>Something went wrong</Text>
      <Text style={styles.stateSub}>Couldn't load stores. Check your connection.</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShopHomeScreen({ route, navigation }) {
  const { postcode = '', locationLabel = '' } = route.params ?? {};
  const initialStores = route.params?.stores ?? [];
  const { logout } = useAuth();

  const [stores, setStores]           = useState(initialStores);
  const [loading, setLoading]         = useState(initialStores.length === 0);
  const [refreshing, setRefreshing]   = useState(false);
  const [hasError, setHasError]       = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const displayLocation = locationLabel || postcode;

  // ── Filter stores by search ───────────────────────────────────────────────
  const visibleStores = searchQuery.trim()
    ? stores.filter((s) =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address?.line1?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : stores;

  // ── Fetch from backend ────────────────────────────────────────────────────
  const fetchStores = useCallback(async (isRefresh = false) => {
    if (!postcode) return;
    setHasError(false);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getNearbyStores({ postcode });
      const fetched = data?.data?.stores ?? data?.stores ?? [];
      setStores(fetched);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postcode]);

  // Auto-fetch on mount only when no initial stores were passed
  useEffect(() => {
    if (initialStores.length === 0 && postcode) {
      fetchStores(false);
    }
  }, []);

  const handleStorePress = (store) => {
    navigation.navigate('StoreCategories', { store });
  };

  // ── List header ───────────────────────────────────────────────────────────
  const ListHeader = () => (
    <View style={styles.listHeader}>
      {/* Featured Banner */}
      <View style={styles.featuredBanner}>
        <Text style={styles.featuredEmoji}>🎉</Text>
        <View style={styles.featuredContent}>
          <Text style={styles.featuredTitle}>CRACK INTO PLEASURE</Text>
          <TouchableOpacity style={styles.featuredBtn} activeOpacity={0.8}>
            <Text style={styles.featuredBtnText}>Shop now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.resultsCount}>
        {visibleStores.length}{' '}
        {visibleStores.length === 1 ? 'store' : 'stores'} near{' '}
        <Text style={styles.resultsCountAccent}>{postcode}</Text>
      </Text>
      {!loading && stores.length > 0 && (
        <Text style={styles.resultsHint}>Tap a store to browse categories</Text>
      )}
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandLine1}>snappy</Text>
            <Text style={styles.brandLine2}>shopper</Text>
          </View>

          {/* Location pill */}
          <View style={styles.locationPill}>
            <Text style={styles.locationPillIcon}>📍</Text>
            <View style={styles.locationPillText}>
              <Text style={styles.locationPillLabel}>Delivering to</Text>
              <Text style={styles.locationPillValue} numberOfLines={1}>
                {displayLocation}
              </Text>
            </View>
          </View>

          {/* Change postcode */}
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={() => navigation.getParent()?.getParent()?.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchBar}>
          <SearchIcon size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Stores"
            placeholderTextColor={Colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── Content ── */}
      {loading ? (
        <LoadingState postcode={postcode} />
      ) : hasError ? (
        <ErrorState onRetry={() => fetchStores(false)} />
      ) : stores.length === 0 ? (
        <EmptyState postcode={postcode} onRefresh={() => fetchStores(false)} />
      ) : (
        <FlatList
          data={visibleStores}
          keyExtractor={(item, i) => item._id ?? item.id ?? String(i)}
          renderItem={({ item }) => (
            <StoreBanner store={item} onPress={() => handleStorePress(item)} />
          )}
          numColumns={1}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.centeredState}>
                <View style={styles.searchEmptyIcon}>
                  <SearchIcon size={28} color={Colors.muted} />
                </View>
                <Text style={styles.stateTitle}>No matching stores</Text>
                <Text style={styles.stateSub}>Try a different search term</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchStores(true)}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  safeArea: {
    backgroundColor: Colors.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  brand: { marginRight: 'auto' },
  brandLine1: {
    fontSize: 13, fontWeight: '800', color: Colors.primary,
    lineHeight: 15, letterSpacing: -0.2,
  },
  brandLine2: {
    fontSize: 17, fontWeight: '900', color: Colors.primary,
    lineHeight: 18, letterSpacing: -0.3,
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginLeft: Spacing.sm,
  },
  locationPillIcon: { fontSize: 12 },
  locationPillText: { flex: 1 },
  locationPillLabel: {
    fontSize: 9, color: Colors.muted, fontWeight: '600',
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  locationPillValue: {
    fontSize: 12, fontWeight: '700', color: Colors.text,
    letterSpacing: 0.2,
  },
  changeBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  changeBtnText: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.white, letterSpacing: 0.3,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.text,
    fontWeight: Typography.weight.medium,
  },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },

  // List
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: BOTTOM_TAB_HEIGHT + 20,
  },
  listHeader: { marginBottom: Spacing.lg },
  featuredBanner: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  featuredContent: { flex: 1, zIndex: 2 },
  featuredTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FBBF24',
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  featuredBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  featuredBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  featuredEmoji: {
    position: 'absolute',
    right: -10,
    bottom: -20,
    fontSize: 110,
    opacity: 0.9,
    zIndex: 1,
  },
  resultsCount: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  resultsCountAccent: { color: Colors.primary },
  resultsHint: {
    fontSize: Typography.size.xs, color: Colors.muted,
    fontWeight: Typography.weight.medium, marginTop: 3,
  },

  // States
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
    gap: Spacing.sm,
  },
  searchEmptyIcon: {
    marginBottom: Spacing.md,
  },
  stateEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  stateTitle: {
    fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold,
    color: Colors.text, textAlign: 'center',
  },
  stateSub: {
    fontSize: Typography.size.sm, color: Colors.muted,
    textAlign: 'center', lineHeight: 20,
  },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 13,
    paddingHorizontal: Spacing['3xl'],
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  retryBtnText: {
    fontSize: Typography.size.base, fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
});

// ─── Store Banner Styles (Foodpanda Style) ────────────────────────────────────

const bannerStyles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: 'transparent',
  },

  // Image section
  imageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  bgImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  imageRounded: {
    borderRadius: 16,
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closedText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // Carousel dots
  dotsRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },

  // Info section (below image)
  infoSection: {
    paddingHorizontal: 2, // Tiny padding so it's not flush to the absolute edge if the image has a border
    paddingVertical: Spacing.sm,
  },

  // Name + Rating row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  storeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
    marginRight: Spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingStar: {
    fontSize: 13,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  ratingCount: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.muted,
  },

  // Meta row
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },

  // Delivery row
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bikeIcon: {
    fontSize: 14,
  },
  deliveryFee: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});

