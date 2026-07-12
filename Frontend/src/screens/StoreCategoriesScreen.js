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
  ImageBackground,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStoreProducts } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const { width } = Dimensions.get('window');
const CAT_COLUMNS = 1;
const DEFAULT_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop';

import { Ionicons, Feather, SimpleLineIcons } from '@expo/vector-icons';

// ─── Store Header ─────────────────────────────────────────────────────────────

function StoreHeader({ store, onBack, onInfo }) {
  const insets = useSafeAreaInsets();
  const bannerUrl = store.branding?.bannerUrl || store.imageUrl || DEFAULT_CATEGORY_IMAGE;
  const logoUrl = store.logoUrl || store.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop';
  const city = store.address?.city || '';
  const storeName = `${store.name}${city ? ` - ${city}` : ''}`;
  const rating = store.averageRating ?? 0;
  const ratingCount = store.ratingCount ?? 0;
  const ratingDisplay = rating > 0 ? Number(rating).toFixed(1) : '0';

  return (
    <View style={headerStyles.container}>
      {/* Banner */}
      <ImageBackground source={{ uri: bannerUrl }} style={headerStyles.banner}>
        <View style={[headerStyles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          {/* Back Button */}
          <TouchableOpacity style={headerStyles.iconBtn} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>

          {/* Right Action Icons */}
          <View style={headerStyles.rightIconsContainer}>
            <TouchableOpacity
              style={headerStyles.iconBtn}
              activeOpacity={0.8}
              onPress={onInfo}
            >
              <Feather name="info" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      {/* Overlapping Logo */}
      <View style={headerStyles.logoWrapper}>
        <Image source={{ uri: logoUrl }} style={headerStyles.logo} />
      </View>

      {/* Info */}
      <View style={headerStyles.infoContainer}>
        <Text style={headerStyles.storeName} numberOfLines={1}>{storeName}</Text>
        <Text style={headerStyles.ratingText}>
          <Text style={headerStyles.starIcon}>⭐ </Text>
          {ratingDisplay}{' '}
          <Text style={headerStyles.ratingCount}>
            ({ratingCount > 100 ? '100+' : ratingCount} ratings)
          </Text>
        </Text>
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
      const data = await getStoreProducts(storeSlug, { page: 1, limit: 100 });
      const fetched = data?.data?.products ?? data?.products ?? [];

      const seen = new Set();
      const cats = [];

      fetched.forEach((p) => {
        if (p.category && !seen.has(p.category.slug)) {
          seen.add(p.category.slug);
          cats.push({ id: p.category.slug, label: p.category.name, slug: p.category.slug, image: p.category.image });
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

  const renderCategory = ({ item }) => {
    const imageUrl = item.image || item.imageUrl || DEFAULT_CATEGORY_IMAGE;
    return (
      <TouchableOpacity
        style={bannerStyles.card}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.9}
      >
        <ImageBackground
          source={{ uri: imageUrl }}
          style={bannerStyles.bgImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <StoreHeader
        store={store}
        onBack={() => navigation.goBack()}
        onInfo={() => navigation.navigate('StoreInfo', { store })}
      />

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
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
  root: { flex: 1, backgroundColor: Colors.white },
  safeArea: { backgroundColor: Colors.white },

  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'] },
  stateEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  stateTitle: { fontSize: Typography.size.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  stateText: { fontSize: Typography.size.sm, color: Colors.muted, marginTop: Spacing.md },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.full },
  retryBtnText: { color: Colors.white, fontWeight: '700' },

  searchSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, // Matches Snappy Shopper light grey background behind search
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md || 8,
    paddingHorizontal: Spacing.md,
    height: 48,
    ...Shadow.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
    color: '#999',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },

  listContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 90,
  },
});

const bannerStyles = StyleSheet.create({
  card: {
    width: '100%',
    height: 160,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
});

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  banner: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.surface,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  rightIconsContainer: {
    flexDirection: 'row',
    gap: 12, // Space between right icons
  },
  iconText: {
    fontSize: 24,
    color: Colors.text,
    fontWeight: '600',
    lineHeight: 26
  },
  smallIconText: {
    fontSize: 18,
    color: Colors.text,
  },
  logoWrapper: {
    alignSelf: 'center',
    marginTop: -35, // Pull up to overlap banner
    width: 70,
    height: 70,
    borderRadius: 16, // Rounded square like Papa Johns
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  logo: {
    width: 60, // Slightly smaller than wrapper to leave a white border effect
    height: 60,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  ratingText: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 6,
  },
  starIcon: { color: '#FF4500' }, // Changed to an orange-red to match Papa Johns style
  ratingCount: {
    color: Colors.textSecondary || '#555',
    fontWeight: '400',
    textDecorationLine: 'underline', // Matches the Papa Johns rating format
  },
});