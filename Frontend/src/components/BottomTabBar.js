import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Typography } from '../theme';

const { width } = Dimensions.get('window');

// ─── Simple SVG-free Icons (pure View + Text) ──────────────────────────────────

function HomeIcon({ focused }) {
  const color = focused ? Colors.primary : Colors.muted;
  return (
    <View style={iconStyles.container}>
      {/* Simple house shape */}
      <View style={[iconStyles.homeRoof, { borderBottomColor: color }]} />
      <View style={[iconStyles.homeBody, { backgroundColor: color }]}>
        <View style={iconStyles.homeDoor} />
      </View>
    </View>
  );
}

function BasketIcon({ focused, badgeCount }) {
  const color = focused ? Colors.primary : Colors.muted;
  return (
    <View style={iconStyles.container}>
      {/* Simple basket/cart shape */}
      <View style={[iconStyles.cartHandle, { borderColor: color }]} />
      <View style={[iconStyles.cartBody, { backgroundColor: color }]} />
      {badgeCount > 0 && (
        <View style={iconStyles.badge}>
          <Text style={iconStyles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function AccountIcon({ focused }) {
  const color = focused ? Colors.primary : Colors.muted;
  return (
    <View style={iconStyles.container}>
      {/* Simple person silhouette */}
      <View style={[iconStyles.personHead, { backgroundColor: color }]} />
      <View style={[iconStyles.personBody, { backgroundColor: color }]} />
    </View>
  );
}

function MoreIcon({ focused }) {
  const color = focused ? Colors.primary : Colors.muted;
  return (
    <View style={iconStyles.container}>
      {/* Three horizontal lines (hamburger) */}
      <View style={[iconStyles.menuLine, { backgroundColor: color }]} />
      <View style={[iconStyles.menuLine, iconStyles.menuLineShort, { backgroundColor: color }]} />
      <View style={[iconStyles.menuLine, { backgroundColor: color }]} />
    </View>
  );
}

const TAB_ICONS = {
  ShopHomeTab: HomeIcon,
  BasketTab: BasketIcon,
  AccountTab: AccountIcon,
  MoreTab: MoreIcon,
};

const TAB_LABELS = {
  ShopHomeTab: 'Home',
  BasketTab: 'Basket',
  AccountTab: 'Account',
  MoreTab: 'More',
};

// ─── Main BottomTabBar Component ────────────────────────────────────────────────

export default function BottomTabBar({ state, descriptors, navigation, cartItemCount = 0 }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      {/* Frosted glass bar */}
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const IconComponent = TAB_ICONS[route.name];
          const label = TAB_LABELS[route.name] || route.name;

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
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.7}
            >
              {/* Active indicator */}
              {isFocused && <View style={styles.activeIndicator} />}
              
              {/* Icon */}
              {IconComponent && (
                <IconComponent
                  focused={isFocused}
                  badgeCount={route.name === 'BasketTab' ? cartItemCount : 0}
                />
              )}

              {/* Label */}
              <Text
                style={[
                  styles.label,
                  isFocused ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  labelInactive: {
    color: Colors.muted,
  },
});

// ─── Icon Styles ────────────────────────────────────────────────────────────────

const iconStyles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Home icon
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  homeBody: {
    width: 16,
    height: 11,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeDoor: {
    width: 6,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // Basket icon
  cartHandle: {
    width: 14,
    height: 8,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderRadius: 7,
    marginBottom: -2,
  },
  cartBody: {
    width: 20,
    height: 13,
    borderRadius: 3,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 10,
  },

  // Account icon
  personHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 2,
  },
  personBody: {
    width: 18,
    height: 9,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  // More icon
  menuLine: {
    width: 18,
    height: 2.5,
    borderRadius: 1.25,
    marginVertical: 1.5,
  },
  menuLineShort: {
    width: 13,
    alignSelf: 'flex-start',
    marginLeft: 3,
  },
});
