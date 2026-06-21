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

// ─── Store Card ───────────────────────────────────────────────────────────────

function StoreCard({ store, onPress }) {
  const isOpen = store.isOpen ?? store.status === 'open';

  const addressLine = [store.address?.line1, store.address?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.82}>
      {/* Open/Closed ribbon */}
      <View style={[cardStyles.ribbon, isOpen ? cardStyles.ribbonOpen : cardStyles.ribbonClosed]}>
        <View style={[cardStyles.ribbonDot, isOpen ? cardStyles.dotOpen : cardStyles.dotClosed]} />
        <Text style={[cardStyles.ribbonText, isOpen ? cardStyles.ribbonTextOpen : cardStyles.ribbonTextClosed]}>
          {isOpen ? 'Open now' : 'Closed'}
        </Text>
      </View>

      <View style={cardStyles.row}>
        {/* Icon */}
        <View style={cardStyles.iconWrapper}>
          <Text style={cardStyles.icon}>🏪</Text>
        </View>

        {/* Info */}
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>{store.name}</Text>
          {!!addressLine && (
            <Text style={cardStyles.address} numberOfLines={1}>{addressLine}</Text>
          )}

          <View style={cardStyles.pillRow}>
            {store.distanceKm != null && (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>📍 {store.distanceKm.toFixed(1)} km</Text>
              </View>
            )}
            {store.deliveryFee != null ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>
                  🚐 £{(store.deliveryFee / 100).toFixed(2)} delivery
                </Text>
              </View>
            ) : store.deliveryRadiusKm != null ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>🚐 {store.deliveryRadiusKm} km radius</Text>
              </View>
            ) : null}
            {store.minOrder != null && (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>
                  Min £{(store.minOrder / 100).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Text style={cardStyles.chevron}>›</Text>
      </View>

      {/* Status label */}
      {!!store.statusLabel && (
        <View style={cardStyles.statusRow}>
          <Text style={cardStyles.statusLabel}>{store.statusLabel}</Text>
        </View>
      )}

      {/* CTA footer */}
      <View style={cardStyles.footer}>
        <Text style={cardStyles.footerCta}>Browse products →</Text>
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
    navigation.navigate('StoreDetail', { store });
  };

  // ── List header ───────────────────────────────────────────────────────────
  const ListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.resultsCount}>
        {visibleStores.length}{' '}
        {visibleStores.length === 1 ? 'store' : 'stores'} near{' '}
        <Text style={styles.resultsCountAccent}>{postcode}</Text>
      </Text>
      {!loading && stores.length > 0 && (
        <Text style={styles.resultsHint}>Tap a store to browse its products</Text>
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
          renderItem={({ item }) => (
            <StoreCard store={item} onPress={() => handleStorePress(item)} />
          )}
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  listHeader: { marginBottom: Spacing.md },
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
  separator: { height: Spacing.md },

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

// ─── Store Card Styles ────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  ribbonOpen: { backgroundColor: '#F0FDF4' },
  ribbonClosed: { backgroundColor: Colors.surface },
  ribbonDot: { width: 7, height: 7, borderRadius: 3.5 },
  dotOpen: { backgroundColor: '#16A34A' },
  dotClosed: { backgroundColor: Colors.muted },
  ribbonText: { fontSize: 11, fontWeight: '700' },
  ribbonTextOpen: { color: '#16A34A' },
  ribbonTextClosed: { color: Colors.muted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
  },
  iconWrapper: {
    width: 58,
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    flexShrink: 0,
  },
  icon: { fontSize: 28 },
  info: { flex: 1 },
  name: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  address: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginBottom: 7,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  chevron: {
    fontSize: 26,
    color: Colors.muted,
    fontWeight: '300',
    lineHeight: 28,
  },

  statusRow: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 8,
  },
  statusLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: '#F8FAFF',
  },
  footerCta: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
});
