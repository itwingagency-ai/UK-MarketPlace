import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, ActivityIndicator, StatusBar, TextInput, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { getStoreStatus } from '../api/stores.api';
import Asset3D from '../components/Asset3D';
import Button from '../components/Button';
import { formatPence } from '../components/ProductCard';
import PriceLines from '../components/PriceLines';
import HandoverPicker from '../components/HandoverPicker';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

// Entrance/exit/layout animations are built once: new builders per render remount views.
const GROUP_IN = Array.from({ length: 8 }, (_, i) =>
  FadeInDown.delay(60 + i * Motion.stagger.cards).springify().damping(Motion.springs.gentle.damping)
);
const ITEM_OUT = FadeOut.duration(180);
const LAYOUT = LinearTransition.springify().damping(Motion.springs.gentle.damping);
const FADE_IN = FadeIn.duration(250);

function attributesText(attributes) {
  if (!attributes) return '';
  return Object.values(attributes).filter(Boolean).join(' · ');
}

function BasketItem({ item, isLast, onOpen, onChange }) {
  const [busy, setBusy] = useState(false);
  const change = async (qty) => {
    if (busy) return;
    setBusy(true);
    await onChange(item, qty);
    setBusy(false);
  };
  const onOffer = item.compareAtPrice && item.compareAtPrice > item.unitPrice;

  return (
    <Animated.View exiting={ITEM_OUT} layout={LAYOUT} style={[styles.item, isLast && styles.itemLast]}>
      <Pressable onPress={onOpen} style={styles.itemImageWrap}>
        <Image source={{ uri: item.image || undefined }} style={styles.itemImage} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onOpen}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        </Pressable>
        {item.minAge ? (
          <View style={styles.ageBadge}><Text style={styles.ageBadgeText}>{item.minAge}+ · ID needed on handover</Text></View>
        ) : null}
        {attributesText(item.attributes) ? (
          <Text style={styles.itemMeta}>{attributesText(item.attributes)}</Text>
        ) : null}
        <View style={styles.itemFooter}>
          <View>
            <Text style={styles.itemPrice}>{formatPence(item.unitPrice * item.quantity)}</Text>
            {onOffer ? (
              <Text style={styles.itemCompare}>{formatPence(item.compareAtPrice * item.quantity)}</Text>
            ) : null}
          </View>
          <View style={styles.stepper}>
            <Pressable onPress={() => change(item.quantity - 1)} style={styles.stepBtn} hitSlop={6}>
              <Feather name={item.quantity === 1 ? 'trash-2' : 'minus'} size={15} color={Colors.text} />
            </Pressable>
            {busy ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ width: 24 }} />
            ) : (
              <Text style={styles.qty}>{item.quantity}</Text>
            )}
            <Pressable onPress={() => change(item.quantity + 1)} style={styles.stepBtn} hitSlop={6}>
              <Feather name="plus" size={15} color={Colors.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function SummaryRow({ label, value, strong, accent }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong, accent && styles.summaryAccent]}>{value}</Text>
    </View>
  );
}

const TIP_CHOICES = [0, 100, 200, 300]; // pence

/** "Add £2.40 more for free delivery" — the server writes the message. */
function NearMiss({ nudge }) {
  const blocking = nudge.blocking;
  return (
    <View style={[styles.nudge, blocking && styles.nudgeBlocking]}>
      <Feather name={blocking ? 'alert-circle' : 'gift'} size={14} color={blocking ? Colors.errorText : Colors.primary} />
      <Text style={[styles.nudgeText, blocking && styles.nudgeTextBlocking]}>{nudge.message}</Text>
    </View>
  );
}

function CouponBox({ coupons, onApply, onRemove }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const res = await onApply(trimmed);
    setBusy(false);
    setFeedback(res.success ? { ok: true, text: res.message } : { ok: false, text: res.error });
    if (res.success) setCode('');
  };

  return (
    <View style={styles.couponCard}>
      <Text style={styles.couponTitle}>Promo code</Text>
      <View style={styles.couponRow}>
        <TextInput
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase()); setFeedback(null); }}
          placeholder="Enter code"
          placeholderTextColor={Colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={styles.couponInput}
          accessibilityLabel="Promo code"
        />
        <Pressable onPress={submit} style={[styles.couponBtn, (!code.trim() || busy) && styles.couponBtnDisabled]} disabled={!code.trim() || busy}>
          {busy ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.couponBtnText}>Apply</Text>}
        </Pressable>
      </View>
      {feedback ? (
        <Text style={[styles.couponFeedback, { color: feedback.ok ? Colors.successText : Colors.errorText }]}>{feedback.text}</Text>
      ) : null}
      {coupons.map((c) => (
        <View key={c.code} style={styles.couponChip}>
          <Feather
            name={c.status === 'applied' ? 'check-circle' : c.status === 'pending' ? 'clock' : 'x-circle'}
            size={15}
            color={c.status === 'applied' ? Colors.successText : c.status === 'pending' ? Colors.warningText : Colors.errorText}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.couponChipCode}>
              {c.code}{c.status === 'applied' && c.discount > 0 ? ` · -${formatPence(c.discount)}` : ''}
            </Text>
            {c.message ? <Text style={styles.couponChipMsg}>{c.message}</Text> : null}
          </View>
          <Pressable onPress={() => onRemove(c.code)} hitSlop={8} accessibilityLabel={`Remove ${c.code}`}>
            <Feather name="x" size={16} color={Colors.textSecondary} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function TipChips({ value, onChange }) {
  const [busy, setBusy] = useState(null);
  const pick = async (amount) => {
    if (busy !== null || amount === value) return;
    setBusy(amount);
    await onChange(amount);
    setBusy(null);
  };
  return (
    <View style={styles.tipWrap}>
      <Text style={styles.tipLabel}>Tip the store's team</Text>
      <View style={styles.tipRow}>
        {TIP_CHOICES.map((amount) => {
          const active = amount === value;
          return (
            <Pressable
              key={amount}
              onPress={() => pick(amount)}
              style={[styles.tipChip, active && styles.tipChipActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              {busy === amount ? (
                <ActivityIndicator size="small" color={active ? Colors.white : Colors.primary} />
              ) : (
                <Text style={[styles.tipChipText, active && styles.tipChipTextActive]}>
                  {amount === 0 ? 'None' : formatPence(amount)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function BasketScreen({ navigation }) {
  const {
    items, byStore, total, subtotal, shippingFee, itemCount, storeId, updateItem, removeItem, isLoading,
    coupons, blockingIssues, discountTotal, feeTotal, tipTotal, options,
    applyCoupon, removeCoupon, setTip, setCartOptions, setFulfilment,
  } = useCart();
  const { isAuthenticated } = useAuth();
  const { showAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const savings = items.reduce((acc, item) => {
    const compare = item.compareAtPrice && item.compareAtPrice > item.unitPrice ? item.compareAtPrice : item.unitPrice;
    return acc + (compare - item.unitPrice) * item.quantity;
  }, 0);

  const handleChange = async (item, qty) => {
    const res = qty <= 0 ? await removeItem(item._id) : await updateItem(item._id, qty);
    if (!res.success) {
      showAlert({ title: "Couldn't update basket", message: res.error, icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    }
  };

  const openProduct = (item) =>
    navigation.navigate('ProductDetail', {
      product: { _id: item.product, title: item.title, price: item.unitPrice, images: [item.image] },
    });

  const reportFailure = (res, title) => {
    if (!res.success) showAlert({ title, message: res.error, icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
  };
  const changeTip = async (sid, amount) => reportFailure(await setTip(sid, amount), "Couldn't update the tip");
  const toggleBags = async (sid, wanted) =>
    reportFailure(await setCartOptions({ stores: [{ storeId: sid, bags: wanted }] }), "Couldn't update bags");
  const dropCoupon = async (code) => reportFailure(await removeCoupon(code), "Couldn't remove that code");
  const changeHandover = async (sid, method, slotStart) => {
    const res = await setFulfilment(sid, method, slotStart);
    reportFailure(res, "Couldn't change that");
    return res.success;
  };

  const handleCheckout = async () => {
    if (itemCount === 0) return;
    const invalid = coupons.find((c) => c.status === 'invalid');
    if (blockingIssues.length > 0 || invalid) {
      showAlert({
        title: 'Before you check out',
        message: blockingIssues[0]?.message || `${invalid.code}: ${invalid.message}. Remove it to continue.`,
        icon: 'alert-circle',
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }
    setIsCheckingOut(true);
    try {
      const storesToCheck = byStore?.length ? byStore : storeId ? [{ storeId }] : [];
      for (const st of storesToCheck) {
        if (!st.storeId) continue;
        const res = await getStoreStatus(st.storeSlug || st.storeId);
        const status = res?.data ?? res;
        if (status && status.isOpen === false) {
          showAlert({
            title: 'Store closed',
            message: `${st.storeName || 'A store in your basket'} is closed right now. ${status.statusLabel || ''}`,
            icon: 'clock',
            showCancel: false,
            confirmText: 'OK',
          });
          return;
        }
      }
      navigation.navigate('Checkout');
    } catch {
      showAlert({ title: 'Connection problem', message: 'Please check your connection and try again.', showCancel: false, confirmText: 'OK' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const goShopping = () => navigation.navigate('ShopHomeTab');

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
      <Text style={styles.title}>Basket</Text>
      {itemCount > 0 ? (
        <Text style={styles.subtitle}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
          {byStore?.length > 1 ? ` from ${byStore.length} stores` : byStore?.[0]?.storeName ? ` from ${byStore[0].storeName}` : ''}
        </Text>
      ) : null}
    </View>
  );

  if (!isAuthenticated || itemCount === 0) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" />
        {header}
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : (
          <Animated.View entering={FADE_IN} style={styles.empty}>
            <Asset3D name="illo-empty-basket" size={170} float />
            <Text style={styles.emptyTitle}>
              {isAuthenticated ? 'Your basket is empty' : 'Log in to start your basket'}
            </Text>
            <Text style={styles.emptyBody}>
              {isAuthenticated
                ? 'Fresh groceries from local stores are a few taps away.'
                : 'Your basket is saved to your account so it follows you everywhere.'}
            </Text>
            <Button
              title={isAuthenticated ? 'Browse stores' : 'Log in'}
              onPress={isAuthenticated ? goShopping : () => navigation.navigate('AccountTab')}
              style={{ marginTop: Spacing.lg, minWidth: 200 }}
            />
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      {header}

      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
        {byStore.map((group, index) => (
          <Animated.View key={String(group.storeId)} entering={GROUP_IN[Math.min(index, 7)]} layout={LAYOUT} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={styles.storeIcon}>
                <Feather name="shopping-bag" size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupTitle} numberOfLines={1}>{group.storeName || `Store ${index + 1}`}</Text>
                <Text style={styles.groupMeta}>
                  {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'} ·{' '}
                  {group.fulfilment?.method === 'collection'
                    ? 'you collect'
                    : `delivery ${group.shippingFee > 0 ? formatPence(group.shippingFee) : 'free'}`}
                </Text>
              </View>
            </View>
            <HandoverPicker
              storeSlug={group.storeSlug || String(group.storeId)}
              fulfilment={group.fulfilment}
              onChange={(method, slotStart) => changeHandover(group.storeId, method, slotStart)}
            />
            {group.items.map((item, i) => (
              <BasketItem
                key={String(item._id)}
                item={item}
                isLast={i === group.items.length - 1}
                onOpen={() => openProduct(item)}
                onChange={handleChange}
              />
            ))}
            {(group.nearMisses || []).slice(0, 2).map((n, i) => (
              <NearMiss key={`${n.kind}-${i}`} nudge={n} />
            ))}
            <PriceLines lines={group.lines} style={styles.groupLines} />
            {(group.optionalFees || []).map((fee) => (
              <View key={fee.code} style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{fee.label}</Text>
                  <Text style={styles.optionHint}>{formatPence(fee.amount)} · switch off if you don't need them</Text>
                </View>
                <Switch
                  value={!fee.removed}
                  onValueChange={(wanted) => toggleBags(group.storeId, wanted)}
                  trackColor={{ true: Colors.primary }}
                  accessibilityLabel={fee.label}
                />
              </View>
            ))}
            <TipChips
              value={Number(options?.tips?.[String(group.storeId)] || 0)}
              onChange={(amount) => changeTip(group.storeId, amount)}
            />
            {byStore.length > 1 ? (
              <View style={styles.groupFooter}>
                <Text style={styles.groupFooterLabel}>Order {index + 1} total</Text>
                <Text style={styles.groupFooterValue}>{formatPence(group.total ?? group.subtotal + group.shippingFee)}</Text>
              </View>
            ) : null}
          </Animated.View>
        ))}

        {byStore.length > 1 ? (
          <View style={styles.note}>
            <Feather name="info" size={16} color={Colors.primary} />
            <Text style={styles.noteText}>
              Items from different stores arrive as separate orders, each with its own delivery.
            </Text>
          </View>
        ) : null}

        <CouponBox coupons={coupons} onApply={applyCoupon} onRemove={dropCoupon} />

        <Animated.View layout={LAYOUT} style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatPence(subtotal)} />
          <SummaryRow label="Delivery" value={shippingFee > 0 ? formatPence(shippingFee) : 'Free'} />
          {discountTotal > 0 ? <SummaryRow label="Offers and codes" value={`-${formatPence(discountTotal)}`} accent /> : null}
          {feeTotal > 0 ? <SummaryRow label="Fees" value={formatPence(feeTotal)} /> : null}
          {tipTotal > 0 ? <SummaryRow label="Tips" value={formatPence(tipTotal)} /> : null}
          {savings > 0 ? <SummaryRow label="Price drops" value={`-${formatPence(savings)}`} accent /> : null}
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatPence(total)} strong />
        </Animated.View>
      </ScrollView>

      <View style={[styles.checkoutBar, { bottom: 96 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkoutLabel}>Total</Text>
          <Text style={styles.checkoutTotal}>{formatPence(total)}</Text>
        </View>
        <Button
          title="Checkout"
          onPress={handleCheckout}
          loading={isCheckingOut}
          icon={<Feather name="lock" size={16} color={Colors.white} />}
          style={{ flex: 1.4 }}
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Typography.family.medium,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
  },
  emptyTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 23,
    letterSpacing: -0.4,
    color: Colors.text,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.family.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  group: {
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    ...Shadow.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  storeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  groupTitle: { fontFamily: Typography.family.display, fontSize: 16, color: Colors.text },
  groupMeta: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  item: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  itemLast: { borderBottomWidth: 0, paddingBottom: 0 },
  itemImageWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  itemImage: { width: '100%', height: '100%' },
  itemTitle: { fontFamily: Typography.family.semibold, fontSize: 14, lineHeight: 19, color: Colors.text },
  itemMeta: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  itemPrice: { fontFamily: Typography.family.displayExtrabold, fontSize: 16, color: Colors.text },
  itemCompare: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 4,
  },
  stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center', fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  groupFooterLabel: { fontFamily: Typography.family.medium, fontSize: 13, color: Colors.textSecondary },
  groupFooterValue: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text },
  note: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySubtle,
    marginBottom: Spacing.base,
  },
  noteText: { flex: 1, fontFamily: Typography.family.regular, fontSize: 13, lineHeight: 18, color: Colors.primary },
  groupLines: { paddingTop: Spacing.sm },
  ageBadge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: Colors.errorBg },
  ageBadgeText: { fontFamily: Typography.family.bold, fontSize: 11, color: Colors.errorText },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySubtle,
  },
  nudgeBlocking: { backgroundColor: Colors.errorBg },
  nudgeText: { flex: 1, fontFamily: Typography.family.medium, fontSize: 13, color: Colors.primary },
  nudgeTextBlocking: { color: Colors.errorText },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  optionLabel: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  optionHint: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  tipWrap: { paddingTop: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  tipLabel: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
  tipRow: { flexDirection: 'row', gap: Spacing.sm },
  tipChip: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tipChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tipChipText: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text },
  tipChipTextActive: { color: Colors.white },
  couponCard: {
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  couponTitle: { fontFamily: Typography.family.display, fontSize: 16, color: Colors.text, marginBottom: Spacing.sm },
  couponRow: { flexDirection: 'row', gap: Spacing.sm },
  couponInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontFamily: Typography.family.semibold,
    fontSize: 15,
    letterSpacing: 1,
    color: Colors.text,
  },
  couponBtn: {
    minWidth: 84,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
  },
  couponBtnDisabled: { backgroundColor: Colors.muted },
  couponBtnText: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.white },
  couponFeedback: { fontFamily: Typography.family.medium, fontSize: 13, marginTop: Spacing.sm },
  couponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
  },
  couponChipCode: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text, letterSpacing: 0.5 },
  couponChipMsg: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  summary: {
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.base,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryLabel: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  summaryStrong: { fontFamily: Typography.family.displayExtrabold, fontSize: 18, color: Colors.text },
  summaryAccent: { color: Colors.successText },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: Spacing.sm },
  checkoutBar: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.md,
    paddingLeft: Spacing.base,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.lg,
  },
  checkoutLabel: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary },
  checkoutTotal: { fontFamily: Typography.family.displayExtrabold, fontSize: 20, color: Colors.text },
});
