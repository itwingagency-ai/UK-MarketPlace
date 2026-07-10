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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getNearbyStores } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const { width } = Dimensions.get('window');

// ─── Store Banner ─────────────────────────────────────────────────────────────

const BG_COLORS = ['#4A148C', '#2E7D32', '#0D47A1', '#E65100', '#C2185B', '#006064'];

function StoreBanner({ store, onPress, index }) {
  const isOpen = store.isOpen ?? store.status === 'open';
  const bgColor = BG_COLORS[index % BG_COLORS.length];

  return (
    <TouchableOpacity
      style={[bannerStyles.card, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={bannerStyles.content}>
        <Text style={bannerStyles.name} numberOfLines={2}>
          {store.name}
        </Text>
        {store.statusLabel && (
          <Text style={bannerStyles.status} numberOfLines={2}>
            {store.statusLabel}
          </Text>
        )}
        <View style={bannerStyles.btn}>
          <Text style={bannerStyles.btnText}>Shop now</Text>
        </View>
      </View>
      {/* Decorative icon on right */}
      <View style={bannerStyles.iconWrapper}>
        <Text style={bannerStyles.icon}>🏪</Text>
      </View>
      
      {/* Open/Closed indicator */}
      <View style={[bannerStyles.indicator, isOpen ? bannerStyles.indicatorOpen : bannerStyles.indicatorClosed]}>
        <View style={[bannerStyles.dot, isOpen ? bannerStyles.dotOpen : bannerStyles.dotClosed]} />
        <Text style={bannerStyles.indicatorText}>{isOpen ? 'Open' : 'Closed'}</Text>
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
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search stores near ${postcode}…`}
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
          renderItem={({ item, index }) => (
            <StoreBanner store={item} index={index} onPress={() => handleStorePress(item)} />
          )}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.centeredState}>
                <Text style={styles.stateEmoji}>🔍</Text>
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
  root: { flex: 1, backgroundColor: Colors.surface },
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
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
    marginHorizontal: Spacing['2xl'],
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 15, color: Colors.muted },
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
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  listHeader: { marginBottom: Spacing.lg },
  featuredBanner: {
    backgroundColor: '#1E1B4B',
    borderRadius: Radius.xl,
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

// ─── Store Banner Styles ──────────────────────────────────────────────────────

const bannerStyles = StyleSheet.create({
  card: {
    flex: 1,
    height: 140,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    padding: Spacing.md,
    position: 'relative',
    ...Shadow.md,
  },
  content: {
    flex: 1,
    zIndex: 2,
    justifyContent: 'flex-start',
  },
  name: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.extrabold,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  status: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  btn: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  iconWrapper: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    opacity: 0.8,
    transform: [{ scale: 1.5 }],
    zIndex: 1,
  },
  icon: {
    fontSize: 60,
  },
  indicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
    zIndex: 3,
  },
  indicatorOpen: {},
  indicatorClosed: {},
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOpen: { backgroundColor: '#4ADE80' },
  dotClosed: { backgroundColor: '#F87171' },
  indicatorText: { fontSize: 9, fontWeight: '700', color: Colors.white },
});
