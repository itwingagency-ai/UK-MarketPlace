import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getOverview, getStockSummary, getStoreSettings, setBusy } from '../../api/vendor.api';
import { useLiveEvent } from '../../context/NotificationsContext';
import { useCustomAlert } from '../../context/AlertContext';
import client from '../../api/client';
import { formatPence } from '../../components/ProductCard';
import { ScreenHeader, Card, SectionTitle, Pill, EmptyState, ActionSheet, sharedStyles } from '../../components/vendor/VendorUI';
import { apiError } from '../../utils/catalog';
import { ORDER_STATUS_META } from './orderStatus';
import { Colors, Radius, Spacing, Typography } from '../../theme';

function Metric({ icon, label, value, tone = Colors.primary, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.metric, pressed && { opacity: 0.85 }]}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone}1A` }]}>
        <Feather name={icon} size={18} color={tone} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <View style={styles.quickIcon}>
        <Feather name={icon} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export default function VendorDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [stock, setStock] = useState(null);
  const [store, setStore] = useState(null);
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const { showAlert } = useCustomAlert();

  const load = useCallback(async () => {
    setError(false);
    const [ov, st, settings, live] = await Promise.allSettled([
      getOverview(),
      getStockSummary(),
      getStoreSettings(),
      client.get('/vendor/dashboard/operating-hours/status'),
    ]);
    if (ov.status === 'fulfilled') setOverview(ov.value);
    else setError(true);
    if (st.status === 'fulfilled') setStock(st.value.data);
    if (settings.status === 'fulfilled') setStore(settings.value.data);
    if (live.status === 'fulfilled') setStatus(live.value.data.data);
  }, []);

  // Refresh whenever the shopkeeper comes back to this tab, or an order arrives
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useLiveEvent(['order:created', 'order:status_changed'], load);

  const changeBusy = async (minutes) => {
    try {
      const res = await setBusy(minutes);
      setStatus((prev) => ({ ...prev, ...res.data }));
      load();
    } catch (err) {
      showAlert({ title: "Couldn't update", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    }
  };
  const busyTime = status?.busyUntil
    ? new Date(status.busyUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const m = overview?.metrics;
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title={store?.storeName || 'My shop'} subtitle={firstName ? `Hi ${firstName} 👋` : undefined} />
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {status ? (
          <Card style={styles.statusCard}>
            <View style={[styles.dot, { backgroundColor: status.isBusy ? Colors.error : status.isOpen ? Colors.success : Colors.warning }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {status.isBusy ? 'Orders paused' : status.isOpen ? 'Open for orders' : 'Closed right now'}
              </Text>
              <Text style={sharedStyles.help}>
                {status.isBusy
                  ? `Customers can order again at ${busyTime}`
                  : status.isOpen
                    ? status.closesAt ? `Closes at ${status.closesAt}` : 'Customers can order now'
                    : status.nextOpenTime ? `Opens ${status.nextOpenDay ? `${status.nextOpenDay} ` : ''}at ${status.nextOpenTime}` : 'Set your opening hours'}
              </Text>
            </View>
            {status.isBusy ? (
              <Pressable onPress={() => changeBusy(0)} style={styles.busyBtn} hitSlop={6} accessibilityRole="button">
                <Text style={styles.busyBtnText}>Resume</Text>
              </Pressable>
            ) : status.isOpen ? (
              <Pressable onPress={() => setPauseOpen(true)} style={styles.busyBtn} hitSlop={6} accessibilityRole="button">
                <Text style={styles.busyBtnText}>Pause</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => navigation.navigate('VendorHours')} hitSlop={8}>
                <Text style={styles.link}>Hours</Text>
              </Pressable>
            )}
          </Card>
        ) : null}

        {error && !overview ? (
          <EmptyState icon="wifi-off" title="Couldn't load your shop" body="Check your connection and pull down to retry." />
        ) : (
          <>
            <View style={styles.grid}>
              <Metric
                icon="clock"
                label="Orders waiting"
                value={m ? m.pendingOrders : '—'}
                tone={Colors.warning}
                onPress={() => navigation.navigate('VendorOrdersTab', { status: 'pending' })}
              />
              <Metric icon="trending-up" label="Revenue (paid)" value={m ? formatPence(m.totalRevenue) : '—'} tone={Colors.success} />
              <Metric
                icon="package"
                label="Products on sale"
                value={m ? `${m.activeProducts}/${m.totalProducts}` : '—'}
                onPress={() => navigation.navigate('VendorProductsTab')}
              />
              <Metric icon="star" label="Rating" value={m && m.averageRating ? Number(m.averageRating).toFixed(1) : 'New'} tone={Colors.warning} />
            </View>

            {stock && (stock.low > 0 || stock.out > 0) ? (
              <Card onPress={() => navigation.navigate('VendorInventory')} style={styles.alertCard}>
                <Feather name="alert-triangle" size={20} color={Colors.warningText} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Stock needs attention</Text>
                  <Text style={sharedStyles.help}>
                    {[stock.out ? `${stock.out} out of stock` : null, stock.low ? `${stock.low} running low` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
              </Card>
            ) : null}

            <SectionTitle>Quick actions</SectionTitle>
            <View style={styles.quickRow}>
              <QuickAction icon="plus-square" label="Add product" onPress={() => navigation.navigate('VendorProductForm')} />
              <QuickAction icon="folder-plus" label="Categories" onPress={() => navigation.navigate('VendorCategories')} />
              <QuickAction icon="layers" label="Stock" onPress={() => navigation.navigate('VendorInventory')} />
              <QuickAction icon="clock" label="Opening hours" onPress={() => navigation.navigate('VendorHours')} />
            </View>

            <SectionTitle
              right={
                <Pressable onPress={() => navigation.navigate('VendorOrdersTab')} hitSlop={8}>
                  <Text style={styles.link}>See all</Text>
                </Pressable>
              }
            >
              Recent orders
            </SectionTitle>
            {overview?.recentOrders?.length ? (
              overview.recentOrders.map((order) => {
                const meta = ORDER_STATUS_META[order.orderStatus] || ORDER_STATUS_META.pending;
                return (
                  <Card
                    key={order._id}
                    onPress={() => navigation.navigate('VendorOrderDetail', { orderId: order._id })}
                    style={styles.orderRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                      <Text style={sharedStyles.help}>{new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.orderTotal}>{formatPence(order.total)}</Text>
                      <Pill label={meta.label} tone={meta.tone} />
                    </View>
                  </Card>
                );
              })
            ) : overview ? (
              <Card><Text style={sharedStyles.help}>No orders yet. New orders will appear here.</Text></Card>
            ) : null}
          </>
        )}
      </ScrollView>

      <ActionSheet
        visible={pauseOpen}
        title="Too busy? Pause new orders"
        onClose={() => setPauseOpen(false)}
        actions={[
          { label: 'Pause for 15 minutes', icon: 'pause-circle', onPress: () => changeBusy(15) },
          { label: 'Pause for 30 minutes', icon: 'pause-circle', onPress: () => changeBusy(30) },
          { label: 'Pause for 1 hour', icon: 'pause-circle', onPress: () => changeBusy(60) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  link: { fontFamily: Typography.family.bold, fontSize: 13, color: Colors.primary },
  busyBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
  },
  busyBtnText: { fontFamily: Typography.family.bold, fontSize: 13, color: Colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metric: {
    width: '47.5%',
    flexGrow: 1,
    padding: Spacing.base,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontFamily: Typography.family.displayExtrabold, fontSize: 22, color: Colors.text, marginTop: Spacing.sm },
  metricLabel: { fontFamily: Typography.family.medium, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.warningBg,
    borderColor: '#FDE68A',
  },
  alertTitle: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  quickRow: { flexDirection: 'row', gap: Spacing.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  quickLabel: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.text, textAlign: 'center' },
  orderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  orderNumber: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  orderTotal: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
});
