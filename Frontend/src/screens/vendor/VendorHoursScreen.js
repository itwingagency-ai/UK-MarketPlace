import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOperatingHours, replaceOperatingHours } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import Button from '../../components/Button';
import { ScreenHeader, Card, PickerSheet, Loading, EmptyState, sharedStyles } from '../../components/vendor/VendorUI';
import { apiError } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

// Half-hour slots keep this simple to use and need no native time picker
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  return `${h}:${i % 2 ? '30' : '00'}`;
}).concat('23:59');

function TimeButton({ value, onPress, label }) {
  return (
    <Pressable onPress={onPress} style={styles.timeBtn} accessibilityRole="button" accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>{value}</Text>
    </Pressable>
  );
}

export default function VendorHoursScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();
  const [schedule, setSchedule] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState(null); // { day, field }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOperatingHours()
      .then((res) => {
        setSchedule(res.data.schedule.map((d) => ({ ...d, open: d.open || '09:00', close: d.close || '17:00' })));
        setStatus(res.data.liveStatus);
      })
      .catch((err) => setError(apiError(err, "Couldn't load opening hours")));
  }, []);

  const update = (day, patch) => setSchedule((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  const save = async () => {
    const bad = schedule.find((d) => !d.isClosed && d.close <= d.open);
    if (bad) {
      showAlert({
        title: 'Check your hours',
        message: `${DAY_LABELS[bad.day]}: closing time must be after opening time.`,
        icon: 'alert-circle',
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }
    setSaving(true);
    try {
      await replaceOperatingHours(schedule.map(({ day, open, close, isClosed }) => ({ day, open, close, isClosed })));
      navigation.goBack();
    } catch (err) {
      showAlert({ title: "Couldn't save hours", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader
        title="Opening hours"
        subtitle={status ? (status.isOpen ? 'Open now' : 'Closed now') : undefined}
        onBack={() => navigation.goBack()}
      />
      {error ? (
        <EmptyState icon="alert-circle" title="Couldn't load hours" body={error} />
      ) : !schedule ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 160 }]}>
          <Text style={[sharedStyles.help, { marginBottom: Spacing.md }]}>
            Customers can only place orders while your shop is open.
          </Text>
          {schedule.map((d) => (
            <Card key={d.day} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <Text style={styles.dayName}>{DAY_LABELS[d.day]}</Text>
                <Text style={[sharedStyles.help, { marginRight: Spacing.sm }]}>{d.isClosed ? 'Closed' : 'Open'}</Text>
                <Switch
                  value={!d.isClosed}
                  onValueChange={(open) => update(d.day, { isClosed: !open })}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={!d.isClosed ? Colors.primary : Colors.white}
                  accessibilityLabel={`${DAY_LABELS[d.day]} open`}
                />
              </View>
              {!d.isClosed ? (
                <View style={styles.times}>
                  <TimeButton label="Opens" value={d.open} onPress={() => setPicker({ day: d.day, field: 'open' })} />
                  <TimeButton label="Closes" value={d.close} onPress={() => setPicker({ day: d.day, field: 'close' })} />
                </View>
              ) : null}
            </Card>
          ))}
        </ScrollView>
      )}

      <View style={[styles.bar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button title="Save hours" size="full" loading={saving} onPress={save} disabled={!schedule} />
      </View>

      <PickerSheet
        visible={!!picker}
        title={picker ? `${DAY_LABELS[picker.day]} — ${picker.field === 'open' ? 'opens' : 'closes'} at` : ''}
        options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
        selected={picker && schedule?.find((d) => d.day === picker.day)?.[picker.field]}
        onSelect={(t) => update(picker.day, { [picker.field]: t })}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dayCard: { marginBottom: Spacing.sm, paddingVertical: Spacing.md },
  dayHead: { flexDirection: 'row', alignItems: 'center' },
  dayName: { flex: 1, fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  times: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  timeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
  },
  timeLabel: { fontFamily: Typography.family.medium, fontSize: 12, color: Colors.textSecondary },
  timeValue: { fontFamily: Typography.family.bold, fontSize: 17, color: Colors.text },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
