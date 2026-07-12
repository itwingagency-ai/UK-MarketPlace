import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../theme';

export default function BasketScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Basket</Text>
        </View>
      </SafeAreaView>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <View style={styles.cartIcon}>
            <View style={[styles.cartHandle, { borderColor: Colors.muted }]} />
            <View style={[styles.cartBody, { backgroundColor: Colors.border }]} />
          </View>
        </View>
        <Text style={styles.title}>Your basket is empty</Text>
        <Text style={styles.subtitle}>
          Browse stores and add items to get started
        </Text>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
    paddingBottom: 100,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  cartIcon: {
    alignItems: 'center',
  },
  cartHandle: {
    width: 20,
    height: 12,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderRadius: 10,
    marginBottom: -2,
  },
  cartBody: {
    width: 28,
    height: 18,
    borderRadius: 4,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  title: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
