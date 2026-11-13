import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Colors, Motion, Radius, Typography } from '../theme';

const TAB_ICONS = {
  ShopHomeTab: 'home',
  BasketTab: 'shopping-bag',
  AccountTab: 'user',
  MoreTab: 'menu',
  // Shopkeeper tabs
  VendorHomeTab: 'grid',
  VendorOrdersTab: 'inbox',
  VendorProductsTab: 'package',
  VendorShopTab: 'settings',
};

const TAB_LABELS = {
  ShopHomeTab: 'Home',
  BasketTab: 'Basket',
  AccountTab: 'Account',
  MoreTab: 'More',
  VendorHomeTab: 'Today',
  VendorOrdersTab: 'Orders',
  VendorProductsTab: 'Products',
  VendorShopTab: 'Shop',
};

const BAR_PADDING = 6;

// ─── Basket badge — bounces whenever the count goes up ─────────────────────────

function BasketBadge({ count }) {
  const scale = useSharedValue(1);
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current) {
      scale.value = withSequence(
        withSpring(1.35, Motion.springs.bouncy),
        withSpring(1, Motion.springs.snappy)
      );
    }
    previous.current = count;
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (count <= 0) return null;

  return (
    <Animated.View style={[styles.badge, animatedStyle]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

// ─── Single tab — press-scale spring ───────────────────────────────────────────

function TabButton({ route, isFocused, options, onPress, onLongPress, badgeCount }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = isFocused ? Colors.primary : Colors.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel || TAB_LABELS[route.name]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => { scale.value = withSpring(0.9, Motion.springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, Motion.springs.snappy); }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        <View>
          <Feather name={TAB_ICONS[route.name] || 'circle'} size={22} color={color} />
          {route.name === 'BasketTab' && <BasketBadge count={badgeCount} />}
        </View>
        <Text style={[styles.label, { color }, isFocused && styles.labelActive]}>
          {TAB_LABELS[route.name] || route.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main BottomTabBar Component ────────────────────────────────────────────────

export default function BottomTabBar({ state, descriptors, navigation, cartItemCount = 0 }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / tabCount : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    indicatorX.value = withSpring(state.index * tabWidth, Motion.springs.snappy);
  }, [state.index, tabWidth, indicatorX]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  if (keyboardVisible) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {tabWidth > 0 && (
          <Animated.View style={[styles.indicator, { width: tabWidth }, indicatorStyle]} />
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabButton
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              onPress={onPress}
              onLongPress={onLongPress}
              badgeCount={route.name === 'BasketTab' ? cartItemCount : 0}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: BAR_PADDING,
    borderRadius: Radius['2xl'],
    // Android draws elevation as a box behind translucent views, so keep it opaque there
    backgroundColor: Platform.OS === 'android' ? Colors.surface : Colors.glassSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  indicator: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySubtle,
  },
  tab: {
    flex: 1,
    minHeight: 52,
  },
  tabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  label: {
    fontFamily: Typography.family.medium,
    fontSize: 11,
    marginTop: 3,
  },
  labelActive: {
    fontFamily: Typography.family.bold,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Typography.family.bold,
    fontSize: 10,
    color: Colors.white,
  },
});
