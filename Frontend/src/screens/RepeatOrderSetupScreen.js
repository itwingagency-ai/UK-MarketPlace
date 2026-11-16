import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { Feather } from '@expo/vector-icons';
import { createRepeatOrder, setupCardForRepeatOrders } from '../api/subscriptions.api';
import { getSavedCards } from '../api/app.api';
import { useCustomAlert } from '../context/AlertContext';
import Button from '../components/Button';
import { ScreenHeader, Card, Chip, ChipRow, sharedStyles } from '../components/vendor/VendorUI';
import { Colors, Spacing, Typography } from '../theme';

const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];
const TIMES = [['Any time', ''], ['Morning', '09:00'], ['Midday', '12:00'], ['Evening', '17:00']];

/**
 * "Make this a regular order": same items, same store, on a schedule.
 * Cards for repeat orders are saved through Stripe (SetupIntent), so they can
 * be charged when the order is placed without you being there.
 */
export default function RepeatOrderSetupScreen({ navigation, route }) {
  const { orderId, storeName, ageCheck } = route.params;
  const { showAlert } = useCustomAlert();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [every, setEvery] = useState('week');
  const [weekday, setWeekday] = useState(new Date().getDay());
  const [dayOfMonth, setDayOfMonth] = useState(Math.min(28, new Date().getDate()));
  const [time, setTime] = useState('');
  const [pay, setPay] = useState('cod');
  const [cards, setCards] = useState([]);
  const [cardId, setCardId] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadCards = async () => {
    const list = await getSavedCards().catch(() => []);
    setCards(list);
    return list;
  };
  useEffect(() => { loadCards(); }, []);

  const fail = (title, err) =>
    showAlert({ title, message: err?.response?.data?.message || err?.message || 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });

  const addCard = async () => {
    setBusy(true);
    try {
      const before = new Set(cards.map((c) => c.id));
      const s = await setupCardForRepeatOrders();
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'UK MarketPlace',
        setupIntentClientSecret: s.setupIntentClientSecret,
        customerId: s.customerId,
        customerEphemeralKeySecret: s.customerEphemeralKeySecret,
        returnURL: 'ukmarketplace://stripe-redirect',
      });
      if (initError) throw new Error(initError.message);
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') throw new Error(error.message);
        return;
      }
      const list = await loadCards();
      const added = list.find((c) => !before.has(c.id)) || list[0];
      if (added) setCardId(added.id);
    } catch (err) {
      fail("Couldn't add the card", err);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (pay === 'card' && !cardId) {
      fail('Choose a card', { message: 'Add or pick a card for repeat orders.' });
      return;
    }
    setBusy(true);
    try {
      const res = await createRepeatOrder({
        orderId,
        every,
        ...(every === 'month' ? { dayOfMonth } : { weekday }),
        preferredTime: time,
        paymentMethod: pay,
        ...(pay === 'card' ? { paymentMethodId: cardId } : {}),
        ...(ageCheck ? { ageConfirmed: true } : {}),
      });
      showAlert({
        title: 'Repeat order set up',
        message: `First one: ${res.data?.upcoming?.[0] ? new Date(`${res.data.upcoming[0]}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : 'soon'}. You can skip, pause or cancel any time.`,
        icon: 'check-circle',
        showCancel: false,
        confirmText: 'OK',
        onConfirm: () => navigation.replace('RepeatOrders'),
      });
    } catch (err) {
      fail("Couldn't set it up", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Repeat this order" subtitle={storeName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[sharedStyles.content, { gap: Spacing.base, paddingBottom: 140 }]}>
        <Card style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>How often</Text>
          <ChipRow>
            {[['Every week', 'week'], ['Every 2 weeks', 'fortnight'], ['Every month', 'month']].map(([l, v]) => (
              <Chip key={v} label={l} active={every === v} onPress={() => setEvery(v)} />
            ))}
          </ChipRow>
          <Text style={[styles.label, { marginTop: Spacing.sm }]}>{every === 'month' ? 'Day of the month' : 'Which day'}</Text>
          {every === 'month' ? (
            <ChipRow>
              {[1, 7, 14, 21, 28].map((d) => <Chip key={d} label={`${d}`} active={dayOfMonth === d} onPress={() => setDayOfMonth(d)} />)}
            </ChipRow>
          ) : (
            <ChipRow>
              {DAYS.map(([l, v]) => <Chip key={v} label={l} active={weekday === v} onPress={() => setWeekday(v)} />)}
            </ChipRow>
          )}
          <Text style={[styles.label, { marginTop: Spacing.sm }]}>Time</Text>
          <ChipRow>
            {TIMES.map(([l, v]) => <Chip key={l} label={l} active={time === v} onPress={() => setTime(v)} />)}
          </ChipRow>
          <Text style={sharedStyles.help}>If the shop offers time slots we book the nearest one; otherwise it's prepared that morning.</Text>
        </Card>

        <Card style={{ gap: Spacing.sm }}>
          <Text style={styles.label}>Pay with</Text>
          <ChipRow>
            <Chip label="Cash on delivery" active={pay === 'cod'} onPress={() => setPay('cod')} />
            <Chip label="Card" active={pay === 'card'} onPress={() => setPay('card')} />
          </ChipRow>
          {pay === 'card' ? (
            <View style={{ gap: Spacing.sm }}>
              {cards.map((c) => (
                <Pressable key={c.id} onPress={() => setCardId(c.id)} style={styles.cardRow} accessibilityRole="radio" accessibilityState={{ checked: cardId === c.id }}>
                  <Feather name={cardId === c.id ? 'check-circle' : 'circle'} size={18} color={cardId === c.id ? Colors.primary : Colors.textSecondary} />
                  <Text style={styles.body}>{c.brand.toUpperCase()} •••• {c.last4}</Text>
                </Pressable>
              ))}
              <Button title="Add a card for repeat orders" variant="outline" onPress={addCard} loading={busy} />
              <Text style={sharedStyles.help}>Charged when each order is placed. If a payment fails we try again the next day and pause after 3 tries.</Text>
            </View>
          ) : null}
        </Card>

        {ageCheck ? (
          <Text style={[sharedStyles.help, { color: Colors.warningText }]}>
            This has over-{ageCheck} items. By setting it up you confirm you're {ageCheck} or over; have ID ready at each handover.
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Set up repeat order" size="lg" onPress={save} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  body: { fontFamily: Typography.family.regular, fontSize: 15, color: Colors.text },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.base, paddingBottom: Spacing.xl, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
});
