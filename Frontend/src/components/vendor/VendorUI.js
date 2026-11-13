import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import Button from '../Button';
import { Colors, Radius, Shadow, Spacing, Typography, Motion } from '../../theme';

/**
 * Small building blocks shared by the shopkeeper screens, built on the app's
 * design tokens so the shop side looks like the customer side.
 */

const SHEET_IN = SlideInDown.springify().damping(Motion.springs.gentle.damping);
const FADE_IN = FadeIn.duration(200);

/** Screen title bar with optional back button and right-hand action. */
export function ScreenHeader({ title, subtitle, onBack, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.circleBtn} accessibilityLabel="Back" hitSlop={6}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Round icon button for header actions. */
export function IconButton({ icon, onPress, label, tone = 'default' }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.circleBtn, tone === 'primary' && styles.circleBtnPrimary]}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
    >
      <Feather name={icon} size={20} color={tone === 'primary' ? Colors.white : Colors.text} />
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({ label, active, onPress, count, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      {icon ? <Feather name={icon} size={13} color={active ? Colors.white : Colors.text} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {count !== undefined ? (
        <Text style={[styles.chipCount, active && styles.chipTextActive]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

const PILL_TONES = {
  success: [Colors.successBg, Colors.successText],
  warning: [Colors.warningBg, Colors.warningText],
  danger: [Colors.errorBg, Colors.errorText],
  info: [Colors.infoBg, Colors.infoText],
  neutral: [Colors.surfaceSecondary, Colors.textSecondary],
  primary: [Colors.primarySubtle, Colors.primary],
};

export function Pill({ label, tone = 'neutral' }) {
  const [bg, fg] = PILL_TONES[tone] || PILL_TONES.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function StockPill({ out, low }) {
  if (out) return <Pill label="Out of stock" tone="danger" />;
  if (low) return <Pill label="Low stock" tone="warning" />;
  return <Pill label="In stock" tone="success" />;
}

/** Labelled on/off setting. */
export function ToggleRow({ label, help, value, onValueChange, disabled }) {
  return (
    <Pressable
      style={styles.toggleRow}
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {help ? <Text style={styles.help}>{help}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : Colors.white}
      />
    </Pressable>
  );
}

/** Looks like an input; opens a picker sheet. */
export function SelectField({ label, value, placeholder, onPress, help }) {
  return (
    <View style={{ marginBottom: Spacing.base }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable onPress={onPress} style={styles.select} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={[styles.selectText, !value && { color: Colors.muted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={Colors.textSecondary} />
      </Pressable>
      {help ? <Text style={[styles.help, { marginTop: 6 }]}>{help}</Text> : null}
    </View>
  );
}

/**
 * Bottom sheet listing options; `depth` indents tree entries (categories).
 * options: [{ value, label, depth?, hint? }]
 */
export function PickerSheet({ visible, title, options, selected, onSelect, onClose, emptyLabel }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FADE_IN} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SHEET_IN} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.length === 0 && emptyLabel ? <Text style={styles.help}>{emptyLabel}</Text> : null}
            {options.map((opt) => {
              const active = String(selected ?? '') === String(opt.value ?? '');
              return (
                <Pressable
                  key={String(opt.value ?? 'none')}
                  onPress={() => { onSelect(opt.value); onClose(); }}
                  style={[styles.sheetRow, active && styles.sheetRowActive, { paddingLeft: Spacing.base + (opt.depth || 0) * 18 }]}
                  accessibilityState={{ selected: active }}
                >
                  {opt.depth ? <Feather name="corner-down-right" size={14} color={Colors.muted} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetText, active && styles.sheetTextActive]}>{opt.label}</Text>
                    {opt.hint ? <Text style={styles.help}>{opt.hint}</Text> : null}
                  </View>
                  {active ? <Feather name="check" size={18} color={Colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Action sheet: [{ label, icon, onPress, destructive }] */
export function ActionSheet({ visible, title, actions, onClose }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FADE_IN} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SHEET_IN} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.handle} />
          {title ? <Text style={styles.sheetTitle} numberOfLines={2}>{title}</Text> : null}
          {actions.filter(Boolean).map((a) => (
            <Pressable
              key={a.label}
              onPress={() => { onClose(); a.onPress(); }}
              style={styles.actionRow}
              accessibilityRole="button"
            >
              <Feather name={a.icon} size={19} color={a.destructive ? Colors.errorText : Colors.text} />
              <Text style={[styles.actionText, a.destructive && { color: Colors.errorText }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function EmptyState({ icon = 'inbox', title, body, actionLabel, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={28} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: Spacing.base }} /> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

/** Floating "add" button above the tab bar. */
export function Fab({ onPress, label, icon = 'plus', bottom = 100 }) {
  return (
    <Pressable onPress={onPress} style={[styles.fab, { bottom }]} accessibilityRole="button" accessibilityLabel={label}>
      <Feather name={icon} size={20} color={Colors.white} />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, paddingBottom: 140 },
  help: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  fieldLabel: {
    fontFamily: Typography.family.semibold,
    fontSize: Typography.size.sm,
    color: Colors.text,
    marginBottom: Spacing.xs + 2,
  },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bg,
  },
  title: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  subtitle: { fontFamily: Typography.family.medium, fontSize: 13, color: Colors.textSecondary },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  circleBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  cardPressed: { opacity: 0.85 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontFamily: Typography.family.display, fontSize: 18, letterSpacing: -0.3, color: Colors.text },
  chipRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },
  chipCount: { fontFamily: Typography.family.medium, fontSize: 12, color: Colors.textSecondary },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  pillText: { fontFamily: Typography.family.semibold, fontSize: 11 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  toggleLabel: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  help: { fontFamily: Typography.family.regular, fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  fieldLabel: {
    fontFamily: Typography.family.semibold,
    fontSize: Typography.size.sm,
    color: Colors.text,
    marginBottom: Spacing.xs + 2,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  selectText: { flex: 1, fontFamily: Typography.family.regular, fontSize: Typography.size.md, color: Colors.text },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: Spacing.base,
  },
  sheetTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 20,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    paddingRight: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
  },
  sheetRowActive: { backgroundColor: Colors.primarySubtle },
  sheetText: { fontFamily: Typography.family.medium, fontSize: 15, color: Colors.text },
  sheetTextActive: { fontFamily: Typography.family.bold, color: Colors.primary },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.sm,
  },
  actionText: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  emptyTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 19,
    color: Colors.text,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.family.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  fab: {
    position: 'absolute',
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    ...Shadow.morphic3d,
  },
  fabText: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.white },
});
