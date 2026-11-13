import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useCart } from '../context/CartContext';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

const BAR_IN = SlideInDown.springify().damping(Motion.springs.snappy.damping);
const BAR_OUT = SlideOutDown.duration(180);

/**
 * "View basket" bar that springs up above the tab bar while the basket has items.
 */
export default function FloatingBasketBar({ onPress, bottom = 104 }) {
  const { itemCount, subtotal, byStore } = useCart();
  if (!itemCount) return null;

  const storeCount = byStore?.length ?? 0;
  const subtitle = storeCount > 1 ? `${storeCount} stores · split at checkout` : byStore?.[0]?.storeName || 'Ready to check out';

  return (
    <Animated.View entering={BAR_IN} exiting={BAR_OUT} style={[styles.wrap, { bottom }]}>
      <Pressable onPress={onPress} style={styles.bar} accessibilityRole="button" accessibilityLabel="View basket">
        <View style={styles.count}>
          <Text style={styles.countText}>{itemCount}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>View basket</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Text style={styles.total}>£{(Number(subtotal || 0) / 100).toFixed(2)}</Text>
        <Feather name="arrow-right" size={18} color={Colors.white} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 60,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.primary,
    ...Shadow.lg,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  count: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  countText: {
    fontFamily: Typography.family.bold,
    fontSize: 14,
    color: Colors.white,
  },
  title: {
    fontFamily: Typography.family.bold,
    fontSize: 15,
    color: Colors.white,
  },
  subtitle: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  total: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 17,
    color: Colors.white,
  },
});
