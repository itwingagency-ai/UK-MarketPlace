import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStoreSlots } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius } from '../theme';

/**
 * Delivery or collection, and when, for one store in the basket.
 * `fulfilment` is the server's view (group.fulfilment from the cart summary);
 * `onChange(method, slotStart)` saves the choice and the cart is re-priced
 * server-side (collection drops the delivery charge).
 */
export default function HandoverPicker({ storeSlug, fulfilment, onChange }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [error, setError] = useState(null);

  const f = fulfilment || { method: 'delivery', asap: true, label: 'As soon as possible', deliveryEnabled: true };
  const methods = [
    f.deliveryEnabled !== false ? ['delivery', 'Delivery', 'truck'] : null,
    f.collectionEnabled ? ['collection', 'Collect', 'shopping-bag'] : null,
  ].filter(Boolean);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSlots(null);
    setError(null);
    getStoreSlots(storeSlug, f.method)
      .then((data) => {
        if (!alive) return;
        setSlots(data);
        const firstOpen = (data.days || []).findIndex((d) => d.slots.some((s) => s.available));
        setDayIdx(Math.max(0, firstOpen));
      })
      .catch(() => alive && setError("Couldn't load times. Please try again."));
    return () => { alive = false; };
  }, [open, storeSlug, f.method]);

  const save = async (method, slotStart) => {
    setBusy(true);
    const ok = await onChange(method, slotStart);
    setBusy(false);
    if (ok) setOpen(false);
  };

  const day = slots?.days?.[dayIdx];

  return (
    <View style={styles.wrap}>
      {methods.length > 1 ? (
        <View style={styles.methods} accessibilityRole="radiogroup">
          {methods.map(([key, label, icon]) => {
            const active = f.method === key;
            return (
              <Pressable
                key={key}
                onPress={() => !active && save(key, null)}
                style={[styles.method, active && styles.methodActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Feather name={icon} size={14} color={active ? Colors.white : Colors.text} />
                <Text style={[styles.methodText, active && styles.methodTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        style={styles.when}
        onPress={() => f.schedulingEnabled && setOpen(true)}
        disabled={!f.schedulingEnabled}
        accessibilityRole="button"
        accessibilityLabel={`${f.method === 'collection' ? 'Collection' : 'Delivery'} time: ${f.label}`}
      >
        <Feather name="clock" size={15} color={Colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.whenLabel}>{f.method === 'collection' ? 'Collect' : 'Deliver'}: {f.label}</Text>
          {f.method === 'collection' && f.collectionAddress?.line1 ? (
            <Text style={styles.whenHint} numberOfLines={2}>
              {[f.collectionAddress.line1, f.collectionAddress.city, f.collectionAddress.postalCode].filter(Boolean).join(', ')}
            </Text>
          ) : null}
          {f.method === 'collection' && f.collectionInstructions ? (
            <Text style={styles.whenHint} numberOfLines={2}>{f.collectionInstructions}</Text>
          ) : null}
        </View>
        {busy ? <ActivityIndicator size="small" color={Colors.primary} /> : f.schedulingEnabled ? <Text style={styles.change}>Change</Text> : null}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.base }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{f.method === 'collection' ? 'Collection time' : 'Delivery time'}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={Colors.text} />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!slots && !error ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} /> : null}

          {slots ? (
            <>
              {slots.asapAvailable ? (
                <Pressable style={[styles.asap, f.asap && styles.slotActive]} onPress={() => save(f.method, null)}>
                  <Feather name="zap" size={15} color={f.asap ? Colors.white : Colors.primary} />
                  <Text style={[styles.slotText, f.asap && styles.slotTextActive]}>As soon as possible</Text>
                </Pressable>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {(slots.days || []).map((d, i) => (
                  <Pressable key={d.date} onPress={() => setDayIdx(i)} style={[styles.day, i === dayIdx && styles.dayActive]}>
                    <Text style={[styles.dayText, i === dayIdx && styles.dayTextActive]}>{d.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.grid}>
                {day && day.slots.length === 0 ? <Text style={styles.empty}>No times left on this day.</Text> : null}
                {(day?.slots || []).map((s) => {
                  const active = !f.asap && f.slotStart && new Date(f.slotStart).getTime() === new Date(s.start).getTime();
                  return (
                    <Pressable
                      key={s.start}
                      disabled={!s.available || busy}
                      onPress={() => save(f.method, s.start)}
                      style={[styles.slot, active && styles.slotActive, !s.available && styles.slotFull]}
                      accessibilityState={{ selected: active, disabled: !s.available }}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive, !s.available && styles.slotTextFull]}>{s.label}</Text>
                      {!s.available ? <Text style={styles.slotSub}>Full</Text> : s.remaining !== null && s.remaining <= 2 ? <Text style={styles.slotSub}>{s.remaining} left</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.md, gap: Spacing.sm },
  methods: { flexDirection: 'row', gap: Spacing.sm },
  method: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  methodActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodText: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  methodTextActive: { color: Colors.white },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
  },
  whenLabel: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  whenHint: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  change: { fontFamily: Typography.family.bold, fontSize: 13, color: Colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    padding: Spacing.base,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sheetTitle: { fontFamily: Typography.family.displayExtrabold, fontSize: 20, color: Colors.text },
  error: { fontFamily: Typography.family.medium, fontSize: 14, color: Colors.errorText, marginVertical: Spacing.md },
  asap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  days: { gap: Spacing.sm, paddingBottom: Spacing.md },
  day: { paddingHorizontal: Spacing.base, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: Colors.surfaceSecondary },
  dayActive: { backgroundColor: Colors.text },
  dayText: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  dayTextActive: { color: Colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.sm },
  empty: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.textSecondary, paddingVertical: Spacing.md },
  slot: {
    width: '31%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  slotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotFull: { backgroundColor: Colors.surfaceSecondary, borderColor: Colors.surfaceSecondary },
  slotText: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  slotTextActive: { color: Colors.white },
  slotTextFull: { color: Colors.muted },
  slotSub: { fontFamily: Typography.family.regular, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});
