import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import * as Location from 'expo-location';
import { getMyDeliveries } from '../../api/rider.api';
import { useAuth } from '../../context/AuthContext';
import { useLiveEvent, useNotifications } from '../../context/NotificationsContext';
import { ScreenHeader, Card, Chip, ChipRow, Pill, EmptyState, Loading, IconButton, sharedStyles } from '../../components/vendor/VendorUI';
import { formatPence } from '../../components/ProductCard';
import { slotText } from '../vendor/orderStatus';
import { apiError } from '../../utils/catalog';
import { Colors, Spacing, Typography } from '../../theme';

const STATUS = {
  pending: ['Waiting for the store', 'warning'],
  confirmed: ['Being packed', 'info'],
  packed: ['Ready to pick up', 'primary'],
  shipped: ['Out for delivery', 'success'],
  delivered: ['Delivered', 'success'],
  cancelled: ['Cancelled', 'danger'],
};

/**
 * Rider home: my deliveries. While any order is out for delivery, the phone's
 * position is shared (foreground only) so customers and the store can follow.
 */
export default function RiderHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { send } = useNotifications();
  const [scope, setScope] = useState('active');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const watchRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setOrders(await getMyDeliveries(scope));
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load your deliveries"));
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);
  useLiveEvent(['order:status_changed', 'order:created'], () => load());

  // Share location only while something is out for delivery
  const outIds = (scope === 'active' ? orders || [] : []).filter((o) => o.orderStatus === 'shipped').map((o) => String(o._id));
  const outKey = outIds.join(',');
  useEffect(() => {
    let cancelled = false;
    const stop = () => {
      watchRef.current?.remove();
      watchRef.current = null;
      setSharing(false);
    };
    if (!outKey) {
      stop();
      return undefined;
    }
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 25 },
        ({ coords }) => {
          outKey.split(',').forEach((orderId) => send('rider:location', { orderId, lat: coords.latitude, lng: coords.longitude }));
        }
      );
      if (!cancelled) setSharing(true);
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [outKey, send]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    const [label, tone] = STATUS[item.orderStatus] || [item.orderStatus, 'neutral'];
    const a = item.shippingAddress || {};
    return (
      <Card onPress={() => navigation.navigate('RiderDelivery', { orderId: item._id })} style={{ gap: 4 }}>
        <View style={styles.rowTop}>
          <Text style={styles.number}>#{item.orderNumber}</Text>
          <Pill label={label} tone={tone} />
        </View>
        <Text style={styles.address} numberOfLines={2}>{[a.line1, a.city, a.postalCode].filter(Boolean).join(', ')}</Text>
        <Text style={sharedStyles.help}>
          {item.store?.name || 'Store'} · {slotText(item.fulfilment)} · {item.paymentMethod === 'cod' && item.paymentStatus !== 'paid' ? `Collect ${formatPence(item.total)} cash` : 'Paid'}
          {item.ageCheck ? ` · ID check ${item.ageCheck}+` : ''}
        </Text>
      </Card>
    );
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader
        title="My deliveries"
        subtitle={sharing ? 'Sharing your location with customers' : user?.name}
        right={<IconButton icon="log-out" label="Sign out" onPress={logout} />}
      />
      <View style={{ paddingHorizontal: Spacing.base }}>
        <ChipRow>
          <Chip label="To do" active={scope === 'active'} onPress={() => setScope('active')} />
          <Chip label="Done today" active={scope === 'done'} onPress={() => setScope('done')} />
        </ChipRow>
      </View>
      {!orders && !error ? <Loading /> : null}
      {error ? <EmptyState icon="alert-circle" title="Something went wrong" body={error} actionLabel="Try again" onAction={load} /> : null}
      {orders ? (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o._id)}
          renderItem={renderItem}
          contentContainerStyle={[sharedStyles.content, { gap: Spacing.sm, paddingBottom: 60 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="truck"
              title={scope === 'active' ? 'No deliveries yet' : 'Nothing delivered today'}
              body={scope === 'active' ? 'The store will assign orders to you here.' : undefined}
            />
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  address: { fontFamily: Typography.family.medium, fontSize: 14, color: Colors.text },
});
