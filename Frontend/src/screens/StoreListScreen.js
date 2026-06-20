import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

function StoreCard({ store, onPress }) {
  const isOpen = store.isOpen ?? store.status === 'open';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.cardHeader}>
        <View style={styles.storeIconWrapper}>
          <Text style={styles.storeIcon}>🏪</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
          {store.address && (
            <Text style={styles.storeAddress} numberOfLines={1}>{store.address}</Text>
          )}
          {store.distance != null && (
            <Text style={styles.storeDistance}>📍 {store.distance.toFixed(1)} km away</Text>
          )}
        </View>
        <View style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}>
          <Text style={[styles.statusText, isOpen ? styles.statusOpenText : styles.statusClosedText]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>
      {store.deliveryFee != null && (
        <View style={styles.cardFooter}>
          <Text style={styles.footerLabel}>
            🚐 Delivery from £{(store.deliveryFee / 100).toFixed(2)}
          </Text>
          {store.minOrder != null && (
            <Text style={styles.footerLabel}>
              · Min order £{(store.minOrder / 100).toFixed(2)}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function StoreListScreen({ route, navigation }) {
  const { stores = [], query = '' } = route.params ?? {};
  const { isAuthenticated } = useAuth();

  const handleStorePress = (store) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    // Navigate to store detail — placeholder for now
    // navigation.navigate('StoreDetail', { slug: store.slug });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerHeading}>Stores near</Text>
            <Text style={styles.headerQuery} numberOfLines={1}>{query}</Text>
          </View>
        </View>
      </SafeAreaView>

      {stores.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🏪</Text>
          <Text style={styles.emptyTitle}>No stores found</Text>
          <Text style={styles.emptySubtitle}>
            We couldn't find any stores near {query}.{'\n'}Try a different postcode.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>Search again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.resultsBanner}>
            <Text style={styles.resultsText}>
              {stores.length} store{stores.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <FlatList
            data={stores}
            keyExtractor={(item, i) => item._id ?? item.id ?? String(i)}
            renderItem={({ item }) => (
              <StoreCard store={item} onPress={() => handleStorePress(item)} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backIcon: { fontSize: 20, color: Colors.text, fontWeight: '600', lineHeight: 22 },
  headerTitle: { flex: 1 },
  headerHeading: {
    fontSize: Typography.size.xs,
    color: Colors.muted,
    fontWeight: Typography.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerQuery: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  resultsBanner: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultsText: {
    fontSize: Typography.size.sm,
    color: Colors.muted,
    fontWeight: Typography.weight.medium,
  },
  list: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  storeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeIcon: { fontSize: 26 },
  cardInfo: { flex: 1 },
  storeName: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  storeAddress: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  storeDistance: {
    fontSize: Typography.size.xs,
    color: Colors.muted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusOpen: { backgroundColor: '#DCFCE7' },
  statusClosed: { backgroundColor: Colors.surfaceSecondary },
  statusText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
  statusOpenText: { color: '#16A34A' },
  statusClosedText: { color: Colors.muted },
  cardFooter: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  footerLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weight.medium,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing['2xl'],
  },
  retryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: Spacing['3xl'],
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryBtnText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
});
