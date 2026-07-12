import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const MENU_ITEMS = [
  { icon: '📋', label: 'My Orders', subtitle: 'View your order history' },
  { icon: '📍', label: 'Saved Addresses', subtitle: 'Manage delivery addresses' },
  { icon: '💳', label: 'Payment Methods', subtitle: 'Manage payment options' },
  { icon: '🔔', label: 'Notifications', subtitle: 'Manage your preferences' },
  { icon: '❓', label: 'Help & Support', subtitle: 'Get help with your orders' },
  { icon: 'ℹ️', label: 'About', subtitle: 'App version & legal' },
];

export default function MoreScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>More</Text>
        </View>
      </SafeAreaView>
      <View style={styles.menuContainer}>
        {MENU_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, index < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconWrapper}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
            </View>
            <View style={styles.menuTextWrapper}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.base,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  menuContainer: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    borderRadius: Radius.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 18 },
  menuTextWrapper: { flex: 1 },
  menuLabel: {
    fontSize: Typography.size.base,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: Typography.size.xs,
    color: Colors.muted,
  },
  menuArrow: {
    fontSize: 22,
    color: Colors.muted,
    fontWeight: '300',
  },
});
