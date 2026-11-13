import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  StatusBar,
  Modal,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { getStoreCategories, getStoreProducts } from '../api/stores.api';
import { useCustomAlert } from '../context/AlertContext';
import ProductCard from '../components/ProductCard';
import FloatingBasketBar from '../components/FloatingBasketBar';
import Asset3D from '../components/Asset3D';
import { Colors, Spacing, Typography, Radius, Motion } from '../theme';

const GAP = Spacing.md;
const PAGE_SIZE = 30;

const isInStock = (p) =>
  p.variants?.length
    ? p.variants.some((v) => v.isActive !== false && Number(v.stock) > 0)
    : Number(p.stock) > 0;

// Entrance animations are built once: a new builder per render remounts views.
const CARD_IN = Array.from({ length: 40 }, (_, i) =>
  FadeInDown.delay(60 + (i % 12) * Motion.stagger.grid).springify().damping(Motion.springs.gentle.damping)
);
const FADE_IN = FadeIn.duration(200);
const SHEET_IN = SlideInDown.springify().damping(Motion.springs.gentle.damping);

const FILTERS = [
  ['under5', 'Under £5', 'tag'],
  ['offer', 'On offer', 'percent'],
  ['stock', 'In stock', 'check-circle'],
];

const SORTS = [
  [null, 'Recommended'],
  ['low', 'Price: low to high'],
  ['high', 'Price: high to low'],
];

function Shimmer({ style }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, style, animated]} />;
}

export default function StoreProductsScreen({ route, navigation }) {
  const { store, category } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - Spacing.base * 2 - GAP) / 2;
  const { showAlert } = useCustomAlert();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const [sort, setSort] = useState(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  // Subcategories picked below the screen's category, outermost first
  const [trail, setTrail] = useState([]);

  const storeKey = store?.slug || store?.id || store?._id;
  const rootId = category && category.slug !== 'all' ? String(category.id || category._id) : null;
  const categoryName = category?.name || category?.label || 'All products';
  const requestId = useRef(0);

  // Shopkeepers can nest categories to any depth; only show branches that
  // have something to sell.
  useEffect(() => {
    if (!storeKey) return;
    getStoreCategories(storeKey)
      .then((data) => setCategories((data?.data?.categories ?? []).filter((c) => c.totalProductCount > 0)))
      .catch(() => setCategories([]));
  }, [storeKey]);

  const childrenOf = useCallback(
    (parentId) => categories.filter((c) => (c.parent ? String(c.parent) : null) === parentId),
    [categories]
  );
  const chipRows = useMemo(() => {
    const rows = [];
    const levels = [rootId, ...trail];
    for (let i = 0; i < levels.length; i += 1) {
      const kids = childrenOf(levels[i]);
      if (kids.length === 0) break;
      rows.push({ level: i, parentId: levels[i], kids, selected: trail[i] ?? null });
    }
    return rows;
  }, [rootId, trail, childrenOf]);
  const activeCategoryId = trail.length ? trail[trail.length - 1] : rootId;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchProducts = useCallback(async (pageNum = 1) => {
    if (!storeKey) return;
    const id = ++requestId.current;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const params = { page: pageNum, limit: PAGE_SIZE };
      if (activeCategoryId) params.category = activeCategoryId;
      if (debouncedQuery) params.search = debouncedQuery;
      const data = await getStoreProducts(storeKey, params);
      if (id !== requestId.current) return; // a newer search/category replaced this one
      const next = data?.data?.products ?? data?.products ?? [];
      setProducts((prev) => (pageNum === 1 ? next : [...prev, ...next]));
      setTotal(data?.data?.total ?? next.length);
      setPage(pageNum);
    } catch {
      if (id === requestId.current && pageNum === 1) setError(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [storeKey, activeCategoryId, debouncedQuery]);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  const loadMore = () => {
    if (loading || loadingMore || products.length >= total) return;
    fetchProducts(page + 1);
  };

  const selectChip = (level, id) =>
    setTrail((prev) => (id === null ? prev.slice(0, level) : [...prev.slice(0, level), id]));

  const visible = useMemo(() => {
    const result = products.filter((p) => {
      if (filters.includes('under5') && p.price > 500) return false;
      if (filters.includes('offer') && !(p.compareAtPrice > p.price)) return false;
      if (filters.includes('stock') && !isInStock(p)) return false;
      return true;
    });
    if (sort === 'low') result.sort((a, b) => a.price - b.price);
    if (sort === 'high') result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, filters, sort]);

  const toggleFilter = (key) =>
    setFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const requireLogin = (type) =>
    showAlert({
      title: type === 'cart' ? 'Log in to add to basket' : 'Log in to save favourites',
      message: 'Create an account or log in to keep shopping.',
      icon: type === 'cart' ? 'shopping-bag' : 'heart',
      confirmText: 'Log in',
      onConfirm: () => navigation.navigate('Login'),
    });

  const openProduct = (product) => navigation.navigate('ProductDetail', { product, store });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} accessibilityLabel="Back">
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{categoryName}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {store?.name}{!loading ? ` · ${filters.length ? visible.length : total} ${(filters.length ? visible.length : total) === 1 ? 'item' : 'items'}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.search}>
          <Feather name="search" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${categoryName.toLowerCase()}`}
            placeholderTextColor={Colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Feather name="x-circle" size={18} color={Colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {chipRows.map((row) => (
          <ScrollView
            key={`${row.level}-${row.parentId}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Pressable
              onPress={() => selectChip(row.level, null)}
              style={[styles.chip, row.selected === null && styles.chipActive]}
              accessibilityState={{ selected: row.selected === null }}
            >
              <Text style={[styles.chipText, row.selected === null && styles.chipTextActive]}>All</Text>
            </Pressable>
            {row.kids.map((kid) => {
              const active = row.selected === String(kid.id);
              return (
                <Pressable
                  key={String(kid.id)}
                  onPress={() => selectChip(row.level, String(kid.id))}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{kid.name}</Text>
                  <Text style={[styles.chipCount, active && styles.chipTextActive]}>{kid.totalProductCount}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ))}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setSortOpen(true)} style={[styles.chip, sort && styles.chipActive]}>
            <Feather name="sliders" size={13} color={sort ? Colors.white : Colors.text} />
            <Text style={[styles.chipText, sort && styles.chipTextActive]}>
              {sort ? SORTS.find((s) => s[0] === sort)[1] : 'Sort'}
            </Text>
          </Pressable>
          {FILTERS.map(([key, label, icon]) => {
            const active = filters.includes(key);
            return (
              <Pressable key={key} onPress={() => toggleFilter(key)} style={[styles.chip, active && styles.chipActive]}>
                <Feather name={icon} size={13} color={active ? Colors.white : Colors.text} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} style={{ width: cardWidth, height: 230, borderRadius: Radius.xl }} />
          ))}
        </View>
      ) : error ? (
        <Animated.View entering={FADE_IN} style={styles.state}>
          <Asset3D name="illo-error-cone" size={120} float />
          <Text style={styles.stateTitle}>Couldn't load products</Text>
          <Pressable onPress={() => fetchProducts(1)}><Text style={styles.stateLink}>Try again</Text></Pressable>
        </Animated.View>
      ) : (
        <Animated.FlatList
          data={visible}
          numColumns={2}
          keyExtractor={(item) => String(item._id || item.id)}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} /> : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={CARD_IN[Math.min(index, CARD_IN.length - 1)]}>
              <ProductCard
                product={item}
                width={cardWidth}
                onPress={() => openProduct(item)}
                onRequireLogin={requireLogin}
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <Animated.View entering={FADE_IN} style={styles.state}>
              <Asset3D name="illo-search-empty" size={120} float />
              <Text style={styles.stateTitle}>Nothing matches</Text>
              <Text style={styles.stateBody}>Try another search or clear your filters.</Text>
            </Animated.View>
          }
        />
      )}

      <FloatingBasketBar onPress={() => navigation.navigate('BasketTab')} />

      {sortOpen ? (
        <Modal transparent visible animationType="none" onRequestClose={() => setSortOpen(false)}>
          <Animated.View entering={FADE_IN} style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSortOpen(false)} />
            <Animated.View entering={SHEET_IN} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Sort by</Text>
              {SORTS.map(([key, label]) => {
                const active = sort === key;
                return (
                  <Pressable
                    key={label}
                    onPress={() => { setSort(key); setSortOpen(false); }}
                    style={[styles.sortRow, active && styles.sortRowActive]}
                  >
                    <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
                    {active ? <Feather name="check" size={18} color={Colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </Animated.View>
          </Animated.View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Typography.family.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
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
  chips: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },
  chipCount: { fontFamily: Typography.family.medium, fontSize: 12, color: Colors.textSecondary },
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: 190,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  skeleton: { backgroundColor: Colors.surfaceTertiary },
  state: { alignItems: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl },
  stateTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  stateBody: {
    fontFamily: Typography.family.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  stateLink: {
    fontFamily: Typography.family.bold,
    fontSize: 15,
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: Spacing.base,
  },
  sheetTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
  },
  sortRowActive: { backgroundColor: Colors.primarySubtle },
  sortText: { fontFamily: Typography.family.medium, fontSize: 15, color: Colors.text },
  sortTextActive: { fontFamily: Typography.family.bold, color: Colors.primary },
});
