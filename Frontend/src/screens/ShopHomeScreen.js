import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  StatusBar,
  TextInput,
  RefreshControl,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useCustomAlert } from '../context/AlertContext';
import { getNearbyStores, getMarketplaceCategories } from '../api/stores.api';
import { useFavorites } from '../context/FavoritesContext';
import Asset3D from '../components/Asset3D';
import BannerCarousel from '../components/BannerCarousel';
import Button from '../components/Button';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

const DEFAULT_STORE_IMAGE = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=800&auto=format&fit=crop';

// Entrance animations are built once: a new builder per render remounts views.
const HEADER_IN = FadeInDown.springify().damping(Motion.springs.gentle.damping);
const CARD_IN = Array.from({ length: 24 }, (_, i) =>
  FadeInDown.delay(120 + i * Motion.stagger.cards).springify().damping(Motion.springs.gentle.damping)
);
const TILE_IN = Array.from({ length: 12 }, (_, i) =>
  FadeInRight.delay(80 + i * Motion.stagger.list).springify().damping(Motion.springs.gentle.damping)
);
const FADE_IN = FadeIn.duration(300);

const FILTERS = [
  ['open', 'Open now', 'clock'],
  ['free', 'Free delivery', 'truck'],
  ['rated', 'Top rated', 'star'],
];

const storeId = (store) => store._id || store.id;

// Shared with the store page: "£2.49 delivery · free over £15"
export function deliveryText(store) {
  const fee = store.deliveryFee;
  if (fee == null) return 'Delivery available';
  if (fee === 0) return 'Free delivery';
  const base = `£${Number(fee).toFixed(2)} delivery`;
  return store.freeDeliveryOver ? `${base} · free over £${Number(store.freeDeliveryOver).toFixed(0)}` : base;
}

function busyUntilText(store) {
  if (!store.busyUntil) return 'Busy right now';
  const time = new Date(store.busyUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Busy · back at ${time}`;
}

function statusText(store) {
  if (store.isBusy) return busyUntilText(store);
  if (store.isOpen) return store.closesAt ? `Open · until ${store.closesAt}` : 'Open now';
  if (store.nextOpenDay && store.nextOpenTime) {
    return ['Today', 'Tomorrow'].includes(store.nextOpenDay)
      ? `Opens ${store.nextOpenDay.toLowerCase()} ${store.nextOpenTime}`
      : `Opens ${store.nextOpenDay} ${store.nextOpenTime}`;
  }
  return 'Closed';
}

// ─── Store card ───────────────────────────────────────────────────────────────

function StoreCard({ store, index, onPress, isFavorited, onToggleFavorite }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));

  const imageUrl = store.branding?.bannerUrl || store.branding?.logoUrl || DEFAULT_STORE_IMAGE;
  const rating = Number(store.averageRating || 0);
  const fee = store.deliveryFee;

  const handleHeart = () => {
    heart.value = 0.7;
    heart.value = withSpring(1, Motion.springs.bouncy);
    onToggleFavorite();
  };

  return (
    <Animated.View entering={CARD_IN[Math.min(index, CARD_IN.length - 1)]} style={pressStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, Motion.springs.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, Motion.springs.snappy); }}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${store.name}, ${statusText(store)}`}
      >
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.cardImage}
          imageStyle={styles.cardImageRadius}
        >
          <View style={styles.cardScrim} />
          {!store.isOpen ? <View style={styles.closedVeil} /> : null}
          <View style={styles.cardTopRow}>
          <View style={[styles.statusPill, !store.isOpen && styles.statusPillClosed]}>
            <View style={[styles.statusDot, !store.isOpen && styles.statusDotClosed]} />
            <Text style={[styles.statusText, !store.isOpen && styles.statusTextClosed]}>
              {statusText(store)}
            </Text>
          </View>
          <Pressable onPress={handleHeart} hitSlop={8} style={styles.heartBtn}>
            <Animated.View style={heartStyle}>
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={19}
                color={isFavorited ? Colors.accent : Colors.text}
              />
            </Animated.View>
          </Pressable>
          </View>
        </ImageBackground>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{store.name}</Text>
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={12} color={Colors.warning} />
              <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
              {store.ratingCount > 0 ? <Text style={styles.ratingCount}>({store.ratingCount})</Text> : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            {store.deliveryTime ? (
              <View style={styles.metaItem}>
                <Feather name="clock" size={13} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{store.deliveryTime}</Text>
              </View>
            ) : null}
            {store.distanceKm != null ? (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={13} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{Number(store.distanceKm).toFixed(1)} km</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Feather name="truck" size={13} color={fee === 0 ? Colors.successText : Colors.textSecondary} />
              <Text style={[styles.metaText, fee === 0 && styles.metaFree]}>
                {deliveryText(store)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Loading / empty / error ─────────────────────────────────────────────────

function Shimmer({ style }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, style, animated]} />;
}

function LoadingState() {
  return (
    <View style={styles.listPad}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Shimmer style={{ height: 150, borderRadius: Radius.xl }} />
          <Shimmer style={{ height: 18, width: '60%', marginTop: Spacing.md }} />
          <Shimmer style={{ height: 14, width: '80%', marginTop: Spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

function StateMessage({ asset, title, body, actionLabel, onAction }) {
  return (
    <Animated.View entering={FADE_IN} style={styles.stateWrap}>
      <Asset3D name={asset} size={132} float />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: Spacing.lg }} />
      ) : null}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShopHomeScreen({ route, navigation }) {
  const { location } = useLocation();
  const postcode = route.params?.postcode || location?.postcode || '';
  const locationLabel = route.params?.locationLabel || location?.label || '';
  const initialStores = route.params?.stores ?? [];

  const { isAuthenticated } = useAuth();
  const { showAlert } = useCustomAlert();
  const { favoriteStores, toggleFavoriteStore } = useFavorites();

  const [stores, setStores] = useState(initialStores);
  const [loading, setLoading] = useState(initialStores.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);

  // Featured marketplace categories (admin's Category Studio). Picking one
  // narrows the list to nearby stores that actually sell it.
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryStores, setCategoryStores] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    getMarketplaceCategories({ featured: true })
      .then((res) => setCategories(res?.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  const displayLocation = locationLabel || postcode;

  const visibleStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = activeCategory && categoryStores ? categoryStores : stores;
    // Open stores first, then nearest
    const ordered = [...base].sort(
      (a, b) => Number(Boolean(b.isOpen)) - Number(Boolean(a.isOpen)) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0)
    );
    return ordered.filter((s) => {
      if (q && ![s.name, s.address?.city, s.address?.line1].some((v) => v?.toLowerCase().includes(q))) {
        return false;
      }
      if (activeFilters.includes('open') && !s.isOpen) return false;
      if (activeFilters.includes('free') && s.deliveryFee !== 0) return false;
      if (activeFilters.includes('rated') && !(Number(s.averageRating) >= 4.5)) return false;
      return true;
    });
  }, [stores, categoryStores, activeCategory, searchQuery, activeFilters]);

  // Prefer coordinates: the server-side postcode geocoder needs a Google key.
  const fetchStores = useCallback(async (isRefresh = false) => {
    const query = location?.lat != null && location?.lng != null
      ? { lat: location.lat, lng: location.lng }
      : postcode ? { postcode } : null;
    if (!query) return;
    setHasError(false);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getNearbyStores(query);
      setStores(data?.data?.stores ?? data?.stores ?? []);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location?.lat, location?.lng, postcode]);

  useEffect(() => {
    if (initialStores.length === 0) fetchStores(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openStore = (store) => navigation.navigate('StoreCategories', { store });

  const toggleCategory = async (category) => {
    if (activeCategory?.slug === category.slug) {
      setActiveCategory(null);
      setCategoryStores(null);
      return;
    }
    const query = location?.lat != null && location?.lng != null
      ? { lat: location.lat, lng: location.lng }
      : postcode ? { postcode } : null;
    if (!query) return;
    setActiveCategory(category);
    setCategoryStores(null);
    setCategoryLoading(true);
    try {
      const data = await getNearbyStores({ ...query, category: category.slug });
      setCategoryStores(data?.data?.stores ?? []);
    } catch {
      setActiveCategory(null);
      showAlert({ title: "Couldn't filter stores", message: 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setCategoryLoading(false);
    }
  };

  const toggleFilter = (key) =>
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleFavourite = (store) => {
    if (!isAuthenticated) {
      showAlert({
        title: 'Log in to save stores',
        message: 'Create an account or log in to keep your favourite stores in one place.',
        icon: 'heart',
        confirmText: 'Log in',
        onConfirm: () => navigation.navigate('Login'),
      });
      return;
    }
    toggleFavoriteStore(storeId(store));
  };

  const isFavourite = (store) =>
    favoriteStores.some((s) => s?._id === storeId(store) || s === storeId(store));

  const header = (
    <View>
      {/* Admin-managed banners and local campaigns */}
      <BannerCarousel lat={location?.lat} lng={location?.lng} />

      {/* Category tiles */}
      {categories.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by category</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tilesRow}
          >
            {categories.map((category, i) => {
              const selected = activeCategory?.slug === category.slug;
              return (
                <Animated.View key={category.slug} entering={TILE_IN[Math.min(i, TILE_IN.length - 1)]}>
                  <Pressable
                    onPress={() => toggleCategory(category)}
                    style={[styles.tile, selected && styles.tileActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={category.name}
                  >
                    <Asset3D name={category.icon3d?.assetKey} size={58} />
                    <Text style={[styles.tileLabel, selected && styles.tileLabelActive]} numberOfLines={1}>{category.name}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Brand banner */}
      <View style={styles.banner}>
        <View style={styles.bannerBlob} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerEyebrow}>From your high street</Text>
          <Text style={styles.bannerTitle}>Local shops, delivered to your door</Text>
        </View>
        <Asset3D name="hero-delivery-scooter" size={96} float />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {FILTERS.map(([key, label, icon]) => {
          const active = activeFilters.includes(key);
          return (
            <Pressable
              key={key}
              onPress={() => toggleFilter(key)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Feather name={icon} size={13} color={active ? Colors.white : Colors.text} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.resultsTitle}>
        {categoryLoading ? 'Finding stores…' : (
          <>
            {visibleStores.length} {visibleStores.length === 1 ? 'store' : 'stores'} near{' '}
            <Text style={styles.resultsAccent}>{postcode || 'you'}</Text>
            {activeCategory ? <> selling <Text style={styles.resultsAccent}>{activeCategory.name}</Text></> : null}
          </>
        )}
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <SafeAreaView edges={['top']} style={styles.top}>
        <Animated.View entering={HEADER_IN} style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>Delivering to</Text>
            <Pressable
              style={styles.locationRow}
              onPress={() => navigation.getParent()?.getParent()?.navigate('Home')}
              hitSlop={6}
            >
              <Feather name="map-pin" size={16} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
              <Feather name="chevron-down" size={16} color={Colors.text} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => navigation.getParent()?.getParent()?.navigate('Home')}
            style={styles.changeBtn}
          >
            <Text style={styles.changeText}>Change</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stores near you"
            placeholderTextColor={Colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Feather name="x-circle" size={18} color={Colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      {loading ? (
        <LoadingState />
      ) : hasError ? (
        <StateMessage
          asset="illo-error-cone"
          title="Something went wrong"
          body="We couldn't load stores. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => fetchStores(false)}
        />
      ) : stores.length === 0 ? (
        <StateMessage
          asset="illo-no-stores"
          title="No stores here yet"
          body={`No stores deliver to ${postcode || 'your area'} right now. New stores join every week.`}
          actionLabel="Change postcode"
          onAction={() => navigation.getParent()?.getParent()?.navigate('Home')}
        />
      ) : (
        <FlatList
          data={visibleStores}
          keyExtractor={(item, i) => String(storeId(item) ?? i)}
          renderItem={({ item, index }) => (
            <StoreCard
              store={item}
              index={index}
              onPress={() => openStore(item)}
              isFavorited={isFavourite(item)}
              onToggleFavorite={() => handleFavourite(item)}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            categoryLoading ? null : activeCategory ? (
              <StateMessage
                asset={activeCategory.icon3d?.assetKey || 'illo-search-empty'}
                title={`No ${activeCategory.name} nearby yet`}
                body="None of the stores that deliver to you sell this right now."
                actionLabel="Show all stores"
                onAction={() => toggleCategory(activeCategory)}
              />
            ) : (
              <StateMessage
                asset="illo-search-empty"
                title="No matching stores"
                body="Try a different search or clear your filters."
              />
            )
          }
          contentContainerStyle={styles.listPad}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.base }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
  root: { flex: 1, backgroundColor: Colors.bg },
  top: {
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  headerEyebrow: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.textTertiary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  locationText: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: Colors.text,
    flexShrink: 1,
  },
  changeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
  },
  changeText: {
    fontFamily: Typography.family.bold,
    fontSize: 13,
    color: Colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 50,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.family.regular,
    fontSize: 15,
    color: Colors.text,
  },
  listPad: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 130,
  },
  sectionHeader: {
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Typography.family.display,
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.text,
  },
  tilesRow: {
    gap: Spacing.md,
    paddingRight: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  tile: {
    width: 84,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tileLabel: {
    fontFamily: Typography.family.semibold,
    fontSize: 12,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  tileActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primaryLight,
  },
  tileLabelActive: {
    color: Colors.primary,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.base,
    paddingRight: Spacing.sm,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.primary,
    overflow: 'hidden',
  },
  bannerBlob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -60,
    top: -90,
    backgroundColor: 'rgba(163, 94, 240, 0.45)',
  },
  bannerEyebrow: {
    fontFamily: Typography.family.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  bannerTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.4,
    color: Colors.white,
    marginTop: 4,
  },
  filtersRow: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: Typography.family.semibold,
    fontSize: 13,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.white,
  },
  resultsTitle: {
    fontFamily: Typography.family.display,
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  resultsAccent: {
    color: Colors.primary,
  },
  card: {
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.md,
  },
  cardImage: {
    height: 156,
    padding: Spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardImageRadius: {
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
  },
  cardScrim: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    backgroundColor: 'rgba(15,23,42,0.08)',
  },
  closedVeil: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  statusPillClosed: {
    backgroundColor: Colors.text,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusDotClosed: {
    backgroundColor: Colors.warning,
  },
  statusText: {
    fontFamily: Typography.family.bold,
    fontSize: 12,
    color: Colors.successText,
  },
  statusTextClosed: {
    color: Colors.white,
  },
  heartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  cardBody: {
    padding: Spacing.base,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontFamily: Typography.family.display,
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.text,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.warningBg,
  },
  ratingText: {
    fontFamily: Typography.family.bold,
    fontSize: 12,
    color: Colors.text,
  },
  ratingCount: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
    rowGap: 4,
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: Typography.family.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaFree: {
    color: Colors.successText,
  },
  skeletonCard: {
    marginTop: Spacing.base,
  },
  skeleton: {
    height: 16,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceTertiary,
  },
  stateWrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  stateTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 21,
    letterSpacing: -0.4,
    color: Colors.text,
    marginTop: Spacing.base,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: Typography.family.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
