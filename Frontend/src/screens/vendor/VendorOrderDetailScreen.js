import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Linking, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getOrder, updateOrderStatus } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import { formatPence } from '../../components/ProductCard';
import Button from '../../components/Button';
import { ScreenHeader, Card, SectionTitle, Pill, EmptyState, Loading, ActionSheet, sharedStyles } from '../../components/vendor/VendorUI';
import { useLiveEvent } from '../../context/NotificationsContext';
import { CANCELLABLE, NEXT_STEP, ORDER_STATUS_META } from './orderStatus';
import { apiError } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function VendorOrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params;
  const { showAlert } = useCustomAlert();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getOrder(orderId);
      setOrder(res.data);
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load this order"));
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);
  // Payment updates or another device changing the order
  useLiveEvent('order:status_changed', (p) => { if (p?.orderId === orderId) load(); });

  const changeStatus = async (orderStatus, note, prepMinutes) => {
    setBusy(true);
    try {
      const res = await updateOrderStatus(orderId, { orderStatus, note, ...(prepMinutes ? { prepMinutes } : {}) });
      setOrder((prev) => ({ ...prev, ...res.data, items: prev.items }));
    } catch (err) {
      showAlert({ title: "Couldn't update order", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () =>
    showAlert({
      title: 'Cancel this order?',
      message: 'The customer is told the order was cancelled and the items go back into your stock.',
      isDestructive: true,
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
      onConfirm: () => changeStatus('cancelled', 'Cancelled by the shop'),
    });

  if (!order) {
    return (
      <View style={sharedStyles.screen}>
        <ScreenHeader title="Order" onBack={() => navigation.goBack()} />
        {error ? <EmptyState icon="alert-circle" title="Couldn't load order" body={error} actionLabel="Try again" onAction={load} /> : <Loading />}
      </View>
    );
  }

  const meta = ORDER_STATUS_META[order.orderStatus] || ORDER_STATUS_META.pending;
  const readyAt = order.tracking?.estimatedReadyAt;
  const readyText = readyAt
    ? new Date(readyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;
  const next = NEXT_STEP[order.orderStatus];
  const address = order.shippingAddress || {};
  const customer = order.customerSnapshot || {};
  const placedNote = (order.statusHistory || [])[0]?.note || '';
  const customerNote = placedNote.includes('Note:') ? placedNote.split('Note:')[1].trim() : '';

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title={`#${order.orderNumber}`} subtitle={fmtDate(order.createdAt)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 200 }]}>
        <Card style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <Text style={sharedStyles.help}>Status</Text>
            <View style={{ marginTop: 4 }}><Pill label={meta.label} tone={meta.tone} /></View>
            {readyText && ['confirmed', 'packed'].includes(order.orderStatus) ? (
              <Text style={[sharedStyles.help, { marginTop: 6 }]}>Customer told: ready by {readyText}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={sharedStyles.help}>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}</Text>
            <Text style={[styles.payment, { color: order.paymentStatus === 'paid' ? Colors.successText : Colors.warningText }]}>
              {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'failed' ? 'Payment failed' : order.paymentStatus === 'refunded' ? 'Refunded' : 'Not paid yet'}
            </Text>
          </View>
        </Card>

        <SectionTitle>Items</SectionTitle>
        <Card>
          {order.items.map((item, i) => {
            const attrs = Object.values(item.attributes || {}).join(' / ');
            const image = item.product?.images?.[0];
            return (
              <View key={item._id || i} style={[styles.item, i > 0 && styles.itemBorder]}>
                <View style={styles.thumb}>
                  {image ? <Image source={{ uri: image }} style={styles.thumbImg} /> : <Feather name="package" size={18} color={Colors.muted} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {attrs ? <Text style={sharedStyles.help}>{attrs}</Text> : null}
                  <Text style={sharedStyles.help}>{item.quantity} × {formatPence(item.unitPrice)}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatPence(item.total)}</Text>
              </View>
            );
          })}
          <View style={styles.totals}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalLabel}>{formatPence(order.subtotal)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Delivery{order.shippingMethod?.name ? ` (${order.shippingMethod.name})` : ''}</Text><Text style={styles.totalLabel}>{formatPence(order.shippingFee)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.grand}>Total</Text><Text style={styles.grand}>{formatPence(order.total)}</Text></View>
          </View>
        </Card>

        {customerNote ? (
          <>
            <SectionTitle>Customer note</SectionTitle>
            <Card><Text style={styles.body}>{customerNote}</Text></Card>
          </>
        ) : null}

        <SectionTitle>Deliver to</SectionTitle>
        <Card style={{ gap: 4 }}>
          <Text style={styles.itemTitle}>{address.fullName || customer.name}</Text>
          <Text style={styles.body}>
            {[address.line1, address.line2, address.city, address.postalCode].filter(Boolean).join(', ')}
          </Text>
          {(address.phone || customer.phone) ? (
            <Pressable onPress={() => Linking.openURL(`tel:${address.phone || customer.phone}`)} style={styles.callRow} hitSlop={6}>
              <Feather name="phone" size={16} color={Colors.primary} />
              <Text style={styles.link}>Call {address.phone || customer.phone}</Text>
            </Pressable>
          ) : null}
          {customer.email ? <Text style={sharedStyles.help}>{customer.email}</Text> : null}
        </Card>

        <SectionTitle>History</SectionTitle>
        <Card>
          {(order.statusHistory || []).map((h, i) => (
            <View key={h._id || i} style={styles.historyRow}>
              <View style={styles.historyDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{ORDER_STATUS_META[h.status]?.label || h.status}</Text>
                <Text style={sharedStyles.help}>{fmtDate(h.changedAt)}{h.note && !h.note.startsWith('Order placed') ? ` · ${h.note}` : ''}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      {next || CANCELLABLE.has(order.orderStatus) ? (
        <View style={styles.bar}>
          {next ? (
            <Button
              title={next.label}
              size="full"
              loading={busy}
              // Accepting asks how long it will take, so the customer knows
              onPress={() => (next.status === 'confirmed' ? setPrepOpen(true) : changeStatus(next.status))}
              icon={<Feather name={next.icon} size={18} color={Colors.white} />}
            />
          ) : null}
          {CANCELLABLE.has(order.orderStatus) ? (
            <Button title="Cancel order" variant="ghost" size="full" disabled={busy} onPress={confirmCancel} textStyle={{ color: Colors.errorText }} />
          ) : null}
        </View>
      ) : null}

      <ActionSheet
        visible={prepOpen}
        title="When will it be ready?"
        onClose={() => setPrepOpen(false)}
        actions={[
          { label: 'Ready in 15 minutes', icon: 'clock', onPress: () => changeStatus('confirmed', undefined, 15) },
          { label: 'Ready in 30 minutes', icon: 'clock', onPress: () => changeStatus('confirmed', undefined, 30) },
          { label: 'Ready in 45 minutes', icon: 'clock', onPress: () => changeStatus('confirmed', undefined, 45) },
          { label: 'Ready in 1 hour', icon: 'clock', onPress: () => changeStatus('confirmed', undefined, 60) },
          { label: 'Accept without a time', icon: 'check', onPress: () => changeStatus('confirmed') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: 'row', alignItems: 'center' },
  payment: { fontFamily: Typography.family.bold, fontSize: 15, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  itemTitle: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  itemTotal: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  totals: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm, paddingTop: Spacing.sm, gap: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.textSecondary },
  grand: { fontFamily: Typography.family.displayExtrabold, fontSize: 17, color: Colors.text },
  body: { fontFamily: Typography.family.regular, fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xs },
  link: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.primary },
  historyRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 6 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.xs,
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
