import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { getRepeatOrders, updateRepeatOrder } from '../api/subscriptions.api';
import { useCustomAlert } from '../context/AlertContext';
import Button from '../components/Button';
import { ScreenHeader, Card, Pill, EmptyState, Loading, sharedStyles } from '../components/vendor/VendorUI';
import { Colors, Spacing, Typography } from '../theme';

const EVERY = { week: 'Every week', fortnight: 'Every 2 weeks', month: 'Every month' };
const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const niceDate = (ymd) => new Date(`${ymd}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** My repeat orders: when the next ones are, skip one, pause, resume or cancel. */
export default function RepeatOrdersScreen({ navigation }) {
  const { showAlert } = useCustomAlert();
  const [subs, setSubs] = useState(null);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSubs(await getRepeatOrders());
    } catch {
      setSubs([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (sub, body) => {
    setBusy(sub._id);
    try {
      const res = await updateRepeatOrder(sub._id, body);
      setSubs((prev) => prev.map((s) => (s._id === sub._id ? { ...s, ...res.data, store: s.store } : s)).filter((s) => s.status !== 'cancelled'));
    } catch (err) {
      showAlert({ title: "Couldn't update it", message: err.response?.data?.message || 'Please try again.', showCancel: false, confirmText: 'OK' });
    } finally {
      setBusy(null);
    }
  };

  const cancel = (sub) =>
    showAlert({
      title: 'Cancel this repeat order?',
      message: "Orders already placed aren't affected.",
      isDestructive: true,
      confirmText: 'Cancel it',
      cancelText: 'Keep it',
      onConfirm: () => act(sub, { action: 'cancel' }),
    });

  const renderItem = ({ item: sub }) => (
    <Card style={{ gap: Spacing.sm }}>
      <View style={styles.top}>
        <Text style={styles.store}>{sub.store?.name || 'Store'}</Text>
        <Pill label={sub.status === 'active' ? 'Active' : 'Paused'} tone={sub.status === 'active' ? 'success' : 'warning'} />
      </View>
      <Text style={styles.body}>
        {EVERY[sub.cadence.every]}
        {sub.cadence.every === 'month' ? ` on the ${sub.cadence.dayOfMonth}` : ` on ${DAYS[sub.cadence.weekday]}`}
        {sub.preferredTime ? ` around ${sub.preferredTime}` : ''} · {sub.paymentMethod === 'card' ? sub.cardLabel || 'Card' : 'Cash'}
      </Text>
      <Text style={sharedStyles.help} numberOfLines={2}>{sub.items.map((i) => `${i.quantity} × ${i.title}`).join(', ')}</Text>
      {sub.status === 'active' && sub.upcoming?.length ? (
        <Text style={styles.body}>Next: <Text style={{ fontFamily: Typography.family.bold }}>{niceDate(sub.upcoming[0])}</Text>{sub.upcoming[1] ? `, then ${niceDate(sub.upcoming[1])}` : ''}</Text>
      ) : null}
      {sub.status === 'paused' && sub.pausedReason ? <Text style={[sharedStyles.help, { color: Colors.warningText }]}>{sub.pausedReason}</Text> : null}
      {sub.lastResult?.message ? <Text style={sharedStyles.help}>Last time: {sub.lastResult.message}</Text> : null}
      <View style={styles.actions}>
        {sub.status === 'active' ? (
          <>
            <Button title="Skip next" size="sm" variant="outline" disabled={busy === sub._id} onPress={() => act(sub, { action: 'skip', date: sub.upcoming[0] })} />
            <Button title="Pause" size="sm" variant="outline" disabled={busy === sub._id} onPress={() => act(sub, { action: 'pause' })} />
          </>
        ) : (
          <Button title="Resume" size="sm" disabled={busy === sub._id} onPress={() => act(sub, { action: 'resume' })} />
        )}
        <Button title="Cancel" size="sm" variant="ghost" disabled={busy === sub._id} onPress={() => cancel(sub)} />
      </View>
    </Card>
  );

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Repeat orders" onBack={() => navigation.goBack()} />
      {!subs ? <Loading /> : (
        <FlatList
          data={subs}
          keyExtractor={(s) => String(s._id)}
          renderItem={renderItem}
          contentContainerStyle={[sharedStyles.content, { gap: Spacing.sm, paddingBottom: 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={Colors.primary} />}
          ListEmptyComponent={<EmptyState icon="repeat" title="No repeat orders" body={'Open a past order and tap "Repeat this order" to get it regularly.'} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  store: { fontFamily: Typography.family.bold, fontSize: 16, color: Colors.text },
  body: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.text },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.xs || 4 },
});
