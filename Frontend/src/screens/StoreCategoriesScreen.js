import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar, Image, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { getStoreCategories } from '../api/stores.api';
import Asset3D, { assetForCategory, paletteForAsset } from '../components/Asset3D';
import Button from '../components/Button';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop';
const BANNER_HEIGHT = 230;

// Entrance animations are built once: a new builder per render remounts views.
const INFO_IN = FadeInDown.delay(60).springify().damping(Motion.springs.gentle.damping);
const TILE_IN = Array.from({ length: 30 }, (_, i) =>
  FadeInDown.delay(140 + i * Motion.stagger.grid).springify().damping(Motion.springs.gentle.damping)
);
const FADE_IN = FadeIn.duration(300);

// ─── Category tile ────────────────────────────────────────────────────────────

function CategoryTile({ name, count, image, asset, index, onPress }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const palette = paletteForAsset(asset);

  return (
    <Animated.View entering={TILE_IN[Math.min(index, TILE_IN.length - 1)]} style={[styles.tileWrap, pressStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95, Motion.springs.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, Motion.springs.snappy); }}
        style={[styles.tile, { backgroundColor: palette.bg }]}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${count} items`}
      >
        <View style={styles.tileArt}>
          {image ? (
            <Image source={{ uri: image }} style={styles.tileImage} />
          ) : (
            <Asset3D name={asset} size={86} />
          )}
        </View>
        <Text style={styles.tileName} numberOfLines={2}>{name}</Text>
        <View style={styles.tileFooter}>
          <Text style={[styles.tileCount, { color: palette.fg }]}>{count} {count === 1 ? 'item' : 'items'}</Text>
          <View style={[styles.tileArrow, { backgroundColor: palette.accent }]}>
            <Feather name="arrow-right" size={14} color={Colors.white} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Shimmer({ style }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, style, animated]} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StoreCategoriesScreen({ route, navigation }) {
  const { store } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const storeKey = store?.slug || store?.id || store?._id;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Banner stretches when pulled down and drifts slower than the content.
  const bannerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0, BANNER_HEIGHT], [-60, 0, BANNER_HEIGHT * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.35, 1], Extrapolation.CLAMP) },
    ],
  }));
  // Solid top bar with the store name fades in once the banner scrolls away.
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [BANNER_HEIGHT - 120, BANNER_HEIGHT - 60], [0, 1], Extrapolation.CLAMP),
  }));

  const fetchCategories = useCallback(async (isRefresh = false) => {
    if (!storeKey) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const data = await getStoreCategories(storeKey);
      const all = data?.data?.categories ?? [];
      setCategories(all.filter((c) => !c.parent && c.totalProductCount > 0));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeKey]);

  useEffect(() => {
    fetchCategories(false);
  }, [fetchCategories]);

  if (!store) return null;

  const openCategory = (category) => navigation.navigate('StoreProducts', { store, category });
  const openAll = () => openCategory({ slug: 'all', name: 'All products' });
  const totalItems = categories.reduce((sum, c) => sum + c.totalProductCount, 0);

  const bannerUrl = store.branding?.bannerUrl || store.branding?.logoUrl || DEFAULT_BANNER;
  const rating = Number(store.averageRating || 0);
  const fee = store.deliveryFee;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.View style={[styles.banner, bannerStyle]}>
        <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} />
        <View style={styles.bannerShade} />
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: BANNER_HEIGHT - 40, paddingBottom: 130 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCategories(true)}
            tintColor={Colors.white}
            progressViewOffset={insets.top + 40}
          />
        }
      >
        <View style={styles.sheet}>
          {/* Store info card */}
          <Animated.View entering={INFO_IN} style={styles.infoCard}>
            <View style={styles.infoTop}>
              <View style={styles.logo}>
                {store.branding?.logoUrl ? (
                  <Image source={{ uri: store.branding.logoUrl }} style={styles.logoImage} />
                ) : (
                  <Text style={styles.logoLetter}>{store.name?.[0]?.toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName} numberOfLines={2}>{store.name}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, !store.isOpen && styles.dotClosed]} />
                  <Text style={[styles.statusText, !store.isOpen && styles.statusTextClosed]}>
                    {store.isBusy
                      ? `Busy · taking orders again at ${new Date(store.busyUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                      : store.isOpen ? `Open${store.closesAt ? ` until ${store.closesAt}` : ' now'}` : 'Closed now'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => navigation.navigate('StoreInfo', { store })}
                style={styles.infoBtn}
                hitSlop={6}
                accessibilityLabel="Store info"
              >
                <Feather name="info" size={18} color={Colors.primary} />
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <View style={styles.statValueRow}>
                  <Ionicons name="star" size={14} color={Colors.warning} />
                  <Text style={styles.statValue}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
                </View>
                <Text style={styles.statLabel}>
                  {store.ratingCount > 0 ? `${store.ratingCount} ratings` : 'No ratings yet'}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {fee == null ? '—' : fee === 0 ? 'Free' : `£${Number(fee).toFixed(2)}`}
                </Text>
                <Text style={styles.statLabel}>
                  {store.freeDeliveryOver && fee ? `Free over £${Number(store.freeDeliveryOver).toFixed(0)}` : 'Delivery'}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {store.distanceKm != null ? `${Number(store.distanceKm).toFixed(1)} km` : '—'}
                </Text>
                <Text style={styles.statLabel}>{store.deliveryTime || 'Away'}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Search inside the store */}
          <Pressable onPress={openAll} style={styles.search} accessibilityRole="search">
            <Feather name="search" size={18} color={Colors.muted} />
            <Text style={styles.searchText} numberOfLines={1}>Search in {store.name}</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by aisle</Text>
            {categories.length > 0 ? (
              <Pressable onPress={openAll} hitSlop={8}>
                <Text style={styles.seeAll}>See all {totalItems}</Text>
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.tileWrap}>
                  <Shimmer style={{ height: 176, borderRadius: Radius['2xl'] }} />
                </View>
              ))}
            </View>
          ) : error ? (
            <Animated.View entering={FADE_IN} style={styles.state}>
              <Asset3D name="illo-error-cone" size={110} float />
              <Text style={styles.stateTitle}>Couldn't load this store</Text>
              <Text style={styles.stateBody}>Check your connection and try again.</Text>
              <Button title="Try again" onPress={() => fetchCategories(false)} style={{ marginTop: Spacing.base }} />
            </Animated.View>
          ) : categories.length === 0 ? (
            <Animated.View entering={FADE_IN} style={styles.state}>
              <Asset3D name="illo-empty-catalogue" size={110} float />
              <Text style={styles.stateTitle}>Shelves are being stocked</Text>
              <Text style={styles.stateBody}>This store hasn't added products yet. Check back soon.</Text>
            </Animated.View>
          ) : (
            <View style={styles.grid}>
              {categories.map((category, index) => {
                // Mapped marketplace category's icon first; name guess for unmapped ones
                const asset = category.globalCategory?.iconKey || assetForCategory(category.name);
                return (
                  <CategoryTile
                    key={category.id}
                    index={index}
                    name={category.name}
                    count={category.totalProductCount}
                    image={category.image}
                    asset={asset}
                    onPress={() => openCategory(category)}
                  />
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating top controls + solid bar that appears on scroll */}
      <Animated.View style={[styles.topBar, { height: insets.top + 56 }, barStyle]}>
        <Text style={[styles.topBarTitle, { marginTop: insets.top }]} numberOfLines={1}>{store.name}</Text>
      </Animated.View>
      <View style={[styles.controls, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('StoreInfo', { store })}
          style={styles.circleBtn}
          accessibilityLabel="Store info"
        >
          <Feather name="more-horizontal" size={20} color={Colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    overflow: 'hidden',
  },
  bannerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  sheet: {
    minHeight: 600,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },
  infoCard: {
    marginTop: -Spacing.xxl,
    padding: Spacing.base,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.lg,
  },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  logoLetter: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 24,
    color: Colors.white,
  },
  storeName: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.4,
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  dotClosed: { backgroundColor: Colors.warning },
  statusText: {
    fontFamily: Typography.family.semibold,
    fontSize: 13,
    color: Colors.successText,
  },
  statusTextClosed: { color: Colors.warningText },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: {
    fontFamily: Typography.family.bold,
    fontSize: 16,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 50,
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchText: {
    flex: 1,
    fontFamily: Typography.family.regular,
    fontSize: 15,
    color: Colors.muted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Typography.family.display,
    fontSize: 19,
    letterSpacing: -0.3,
    color: Colors.text,
  },
  seeAll: {
    fontFamily: Typography.family.bold,
    fontSize: 13,
    color: Colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.sm / 2,
  },
  tileWrap: {
    width: '50%',
    padding: Spacing.sm / 2,
  },
  tile: {
    height: 176,
    borderRadius: Radius['2xl'],
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  tileArt: {
    alignItems: 'flex-end',
    marginTop: -4,
    marginRight: -4,
  },
  tileImage: {
    width: 86,
    height: 86,
    borderRadius: Radius.lg,
  },
  tileName: {
    fontFamily: Typography.family.display,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: Colors.text,
    marginTop: 'auto',
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tileCount: {
    fontFamily: Typography.family.semibold,
    fontSize: 12,
  },
  tileArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    backgroundColor: Colors.surfaceTertiary,
  },
  state: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  stateTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 19,
    color: Colors.text,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: Typography.family.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    paddingHorizontal: 64,
  },
  topBarTitle: {
    fontFamily: Typography.family.display,
    fontSize: 16,
    color: Colors.text,
  },
  controls: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    ...Shadow.md,
  },
});
