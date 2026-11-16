import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSavedCards, removeSavedCard } from '../api/app.api';
import { useCustomAlert } from '../context/AlertContext';
import { ScreenHeader, Card, EmptyState, Loading, sharedStyles } from '../components/vendor/VendorUI';
import { Colors, Spacing, Typography } from '../theme';

/** Cards saved at checkout (kept by Stripe, never by us). */
export default function SavedCardsScreen({ navigation }) {
  const { showAlert } = useCustomAlert();
  const [cards, setCards] = useState(null);

  const load = useCallback(async () => {
    try {
      setCards(await getSavedCards());
    } catch {
      setCards([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (card) =>
    showAlert({
      title: 'Remove this card?',
      message: `${card.brand.toUpperCase()} ending ${card.last4} won't be offered at checkout any more.`,
      isDestructive: true,
      confirmText: 'Remove',
      cancelText: 'Keep',
      onConfirm: async () => {
        try {
          await removeSavedCard(card.id);
          load();
        } catch (err) {
          showAlert({ title: "Couldn't remove it", message: err.response?.data?.message || 'Please try again.', showCancel: false, confirmText: 'OK' });
        }
      },
    });

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Saved cards" onBack={() => navigation.goBack()} />
      {!cards ? <Loading /> : cards.length === 0 ? (
        <EmptyState icon="credit-card" title="No saved cards" body="Tick “Save this card” when you pay by card, and it'll be here next time." />
      ) : (
        <View style={[sharedStyles.content, { gap: Spacing.sm }]}>
          {cards.map((c) => (
            <Card key={c.id} style={styles.row}>
              <Feather name="credit-card" size={20} color={Colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{c.brand.toUpperCase()} •••• {c.last4}</Text>
                {c.expMonth ? <Text style={sharedStyles.help}>Expires {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}</Text> : null}
              </View>
              <Pressable onPress={() => remove(c)} hitSlop={10} accessibilityLabel={`Remove card ending ${c.last4}`}>
                <Feather name="trash-2" size={18} color={Colors.errorText} />
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
});
