import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function AccountScreen({ navigation }) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
          {/* <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <Feather name="settings" size={24} color={Colors.text} />
          </TouchableOpacity> */}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Text style={styles.profileName}>{user?.name}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.viewProfileText}>View profile</Text>
          </TouchableOpacity>
        </View>

        {/* Promo Banner */}
        <TouchableOpacity style={styles.promoBanner} activeOpacity={0.9}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Everything You Need, One Tap Away</Text>
            <View style={styles.promoActionRow}>
            </View>
          </View>
          <View style={styles.promoGraphicPlaceholder}>
            <MaterialCommunityIcons name="shopping-outline" size={60} color="rgba(255,255,255,0.4)" />
            <MaterialCommunityIcons name="ticket-percent-outline" size={35} color="rgba(255,255,255,0.5)" style={styles.promoTicketIcon} />
          </View>
        </TouchableOpacity>

        {/* Action Grid */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7} onPress={() => navigation.navigate('Orders')}>
            <Ionicons name="receipt-outline" size={28} color={Colors.text} />
            <Text style={styles.actionCardText}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7} onPress={() => navigation.navigate('Favourites')}>
            <Feather name="heart" size={28} color={Colors.text} />
            <Text style={styles.actionCardText}>Favourites</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
            <Ionicons name="location-outline" size={28} color={Colors.text} />
            <Text style={styles.actionCardText}>Addresses</Text>
          </TouchableOpacity>
        </View>

        {/* General Section */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>General</Text>
        <View style={styles.generalList}>
          <TouchableOpacity style={styles.generalItem} activeOpacity={0.7}>
            <View style={styles.generalItemLeft}>
              <Feather name="help-circle" size={22} color={Colors.text} />
              <Text style={styles.generalItemText}>Help center</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.divider} />

          <TouchableOpacity style={styles.generalItem} activeOpacity={0.7}>
            <View style={styles.generalItemLeft}>
              <Ionicons name="document-text-outline" size={22} color={Colors.text} />
              <Text style={styles.generalItemText}>Terms & policies</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Text style={styles.logoutBtnText}>Log out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  headerIconBtn: {
    padding: Spacing.xs,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },

  /* Profile */
  profileSection: {
    marginBottom: Spacing['2xl'],
    marginTop: Spacing.sm,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  viewProfileText: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },

  /* Promo Banner */
  promoBanner: {
    backgroundColor: '#50178E',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  promoContent: {
    flex: 1,
    paddingRight: Spacing.md,
    zIndex: 2,
  },
  promoTitle: {
    color: Colors.white,
    fontSize: Typography.size.lg,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  promoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoActionText: {
    color: Colors.white,
    fontSize: Typography.size.sm,
    fontWeight: '600',
  },
  promoChevron: {
    marginLeft: 4,
    marginTop: 2,
  },
  promoGraphicPlaceholder: {
    position: 'absolute',
    right: -20,
    bottom: -15,
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  promoTicketIcon: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    transform: [{ rotate: '-15deg' }]
  },

  /* Action Grid */
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing['2xl'],
    gap: Spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  actionCardText: {
    marginTop: Spacing.sm,
    fontSize: Typography.size.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  /* Section Titles */
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  /* Wallet */
  walletCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pandapayLogo: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: Spacing.md,
  },
  pandapayLogoText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  walletTitle: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },
  walletAmount: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },

  /* General List */
  generalList: {
    marginBottom: Spacing['3xl'],
  },
  generalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  generalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generalItemText: {
    marginLeft: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 38,
  },

  /* Log Out */
  logoutBtn: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.text,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  logoutBtnText: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },

  /* Version */
  versionText: {
    textAlign: 'center',
    fontSize: Typography.size.sm,
    color: Colors.muted,
    marginBottom: Spacing['2xl'],
  },
});
