import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { getOrders } from '../../api/vendor.api';
import { useLiveEvent } from '../../context/NotificationsContext';
import { formatPence } from '../../components/ProductCard';
import { ScreenHeader, Card, Chip, ChipRow, Pill, EmptyState, Loading, sharedStyles } from '../../components/vendor/VendorUI';
import { ORDER_FILTERS, ORDER_STATUS_META, isWaitingOutside, slotText } from './orderStatus';
import { apiError } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const PAGE_SIZE = 20;

export default function VendorOrdersScreen({ navigation, route }) {
  const [status, setStatus] = useState(route.params?.status ?? '');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  // The dashboard can open this tab pre-filtered
  useEffect(() => {
    if (route.params?.status !== undefined) setStatus(route.params.status);
  }, [route.params?.status]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (pageNum = 1) => {
    const id = ++requestId.current;
    if (pageNum > 1) setLoadingMore(true);
    try {
      const res = await getOrders({ page: pageNum, limit: PAGE_SIZE, status: status || undefined, search: query || undefined });
      if (id !== requestId.current) return;
      setOrders((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.total);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(apiError(err, "Couldn't load orders"));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [status, query]);

  useFocusEffect(useCallback(() => { load(1); }, [load]));
  // New orders and status changes appear without pulling to refresh
  useLiveEvent(['order:created', 'order:status_changed', 'order:customer_arrived'], () => load(1));

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  };

  const renderOrder = ({ item }) => {
    const meta = ORDER_STATUS_META[item.orderStatus] || ORDER_STATUS_META.pending;
    return (
      <Card onPress={() => navigation.navigate('VendorOrderDetail', { orderId: item._id })} style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.number}>#{item.orderNumber}</Text>
          <Text style={styles.customer} numberOfLines={1}>{item.customerSnapshot?.name || item.customer?.name || 'Customer'}</Text>
          <Text style={sharedStyles.help}>
            {new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {' · '}
            {item.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
            {item.paymentStatus === 'paid' ? ' · Paid' : ''}
          </Text>
          <Text style={[sharedStyles.help, { color: Colors.text }]}>
            {item.fulfilment?.method === 'collection' ? 'Collection' : 'Delivery'} · {slotText(item.fulfilment)}
          </Text>
          {isWaitingOutside(item) ? <Pill label="Customer outside" tone="warning" /> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={styles.total}>{formatPence(item.total)}</Text>
          <Pill label={meta.label} tone={meta.tone} />
        </View>
      </Card>
    );
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Orders" subtitle={!loading ? `${total} ${total === 1 ? 'order' : 'orders'}` : undefined} />
      <View style={styles.controls}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Order number or customer"
            placeholderTextColor={Colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
        <ChipRow>
          {ORDER_FILTERS.map(([key, label]) => (
            <Chip key={key || 'all'} label={label} active={status === key} onPress={() => { setLoading(true); setStatus(key); }} />
          ))}
        </ChipRow>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          renderItem={renderOrder}
          contentContainerStyle={[sharedStyles.content, { paddingTop: Spacing.sm }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={() => { if (!loadingMore && orders.length < total) load(page + 1); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.base }} /> : null}
          ListEmptyComponent={
            error ? (
              <EmptyState icon="wifi-off" title="Couldn't load orders" body={error} actionLabel="Try again" onAction={() => load(1)} />
            ) : (
              <EmptyState
                icon="shopping-bag"
                title={status || query ? 'No matching orders' : 'No orders yet'}
                body={status || query ? 'Try another filter.' : 'When customers order from your shop, the orders appear here.'}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 46,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontFamily: Typography.family.regular, fontSize: 15, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  number: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  customer: { fontFamily: Typography.family.medium, fontSize: 14, color: Colors.textSecondary },
  total: { fontFamily: Typography.family.displayExtrabold, fontSize: 16, color: Colors.text },
});
