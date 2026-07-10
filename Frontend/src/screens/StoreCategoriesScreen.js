import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStoreProducts } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const { width } = Dimensions.get('window');
const CAT_COLUMNS = 4;
const CAT_WIDTH = (width - Spacing['2xl'] * 2 - Spacing.md * (CAT_COLUMNS - 1)) / CAT_COLUMNS;

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

function getCategoryColor(index) {
  const colors = ['#E0F2FE', '#DCFCE7', '#FEF3C7', '#FEE2E2', '#F3E8FF', '#FFEDD5', '#E0E7FF', '#FAFAFA'];
  return colors[index % colors.length];
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
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StoreCategoriesScreen({ route, navigation }) {
  const { store } = route.params ?? {};
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const storeSlug = store?.slug;

  const fetchCategories = useCallback(async (isRefresh = false) => {
    if (!storeSlug) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      // Fetch a large page of products just to extract categories
      const data = await getStoreProducts(storeSlug, { page: 1, limit: 100 });
      const fetched = data?.data?.products ?? data?.products ?? [];
      
      const seen = new Set();
      const cats = [{ id: 'all', label: 'All Products', slug: 'all' }];
      
      fetched.forEach((p) => {
        if (p.category && !seen.has(p.category.slug)) {
          seen.add(p.category.slug);
          cats.push({ id: p.category.slug, label: p.category.name, slug: p.category.slug });
        }
      });
      
      setCategories(cats);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCategoryPress = (category) => {
    navigation.navigate('StoreProducts', { store, category });
  };

  const renderCategory = ({ item, index }) => (
    <TouchableOpacity 
      style={styles.categoryItem} 
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.circle, { backgroundColor: getCategoryColor(index) }]}>
        <Text style={styles.circleEmoji}>{getCategoryEmoji(item.slug)}</Text>
      </View>
      <Text style={styles.categoryLabel} numberOfLines={2}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StoreHeader store={store} onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Loading categories…</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateEmoji}>⚠️</Text>
          <Text style={styles.stateTitle}>Couldn't load categories</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCategories(false)}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategory}
          numColumns={CAT_COLUMNS}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Shop by category</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCategories(true)}
              tintColor={Colors.primary}
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
  safeArea: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  
  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'] },
  stateEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  stateTitle: { fontSize: Typography.size.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  stateText: { fontSize: Typography.size.sm, color: Colors.muted, marginTop: Spacing.md },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.full },
  retryBtnText: { color: Colors.white, fontWeight: '700' },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
    letterSpacing: -0.5,
  },

  listContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },

  categoryItem: {
    width: CAT_WIDTH,
    alignItems: 'center',
  },
  circle: {
    width: CAT_WIDTH,
    height: CAT_WIDTH,
    borderRadius: CAT_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  circleEmoji: {
    fontSize: CAT_WIDTH * 0.45,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
});

const headerStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  backIcon: { fontSize: 20, color: Colors.text, fontWeight: '600', lineHeight: 22 },
  storeIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#BFDBFE' },
  storeIcon: { fontSize: 24 },
  topInfo: { flex: 1 },
  storeName: { fontSize: Typography.size.md, fontWeight: Typography.weight.extrabold, color: Colors.text, letterSpacing: -0.3 },
  storeAddress: { fontSize: Typography.size.xs, color: Colors.muted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, gap: 5, alignSelf: 'flex-start' },
  statusOpen: { backgroundColor: '#DCFCE7' },
  statusClosed: { backgroundColor: Colors.surfaceSecondary },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  dotOpen: { backgroundColor: '#16A34A' },
  dotClosed: { backgroundColor: Colors.muted },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusOpenText: { color: '#16A34A' },
  statusClosedText: { color: Colors.muted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  metaPillText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
});
