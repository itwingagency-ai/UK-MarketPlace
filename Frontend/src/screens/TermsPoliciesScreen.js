import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';

const POLICIES = [
  {
    id: 'terms',
    title: 'Terms of Service',
    icon: 'file-text',
    subtitle: 'User agreement, account responsibilities, and rules of conduct',
    content: `1. Acceptance of Terms
By accessing or using UK-MarketPlace, you agree to be bound by these Terms of Service and all applicable laws and regulations in the United Kingdom.

2. User Accounts & Security
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.

3. Orders & Marketplace Role
UK-MarketPlace acts as a multi-vendor platform connecting UK customers with independent local stores and merchants. While we facilitate transactions and payment processing via Stripe, the respective store is responsible for fulfilling your order and ensuring product quality.

4. Pricing & Availability
All prices are displayed in GBP (£) and include applicable UK VAT unless stated otherwise. Prices and item availability are subject to change by individual merchants without prior notice.`
  },
  {
    id: 'privacy',
    title: 'Privacy Policy & UK GDPR',
    icon: 'shield',
    subtitle: 'How we collect, protect, and process your personal data',
    content: `1. Data Protection Commitment
We adhere strictly to the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We respect your privacy and are committed to protecting your personal data.

2. Information We Collect
We collect personal information you provide when registering, placing orders, or contacting support, including your name, email address, delivery postcode, and phone number. Payment details are encrypted and handled directly by our payment processor (Stripe); we never store full credit or debit card numbers.

3. How We Use Your Data
Your data is used solely to facilitate order delivery, process secure payments, send transactional notifications, and improve our marketplace services. We do not sell your personal data to third parties.

4. Your Rights
Under UK data protection laws, you have the right to access, rectify, or erase your personal data stored on our platform. To exercise your rights, contact our Data Protection Officer at privacy@uk-marketplace.co.uk.`
  },
  {
    id: 'refunds',
    title: 'Refund & Cancellation Policy',
    icon: 'refresh-cw',
    subtitle: 'Order cancellations, returns, and dispute resolution',
    content: `1. Order Cancellation
You may cancel your order without penalty before the store accepts and begins preparing your items. Once an order is in preparation or dispatched, cancellation is subject to store approval.

2. Damaged or Incorrect Items
If you receive damaged, defective, or incorrect items, you are entitled to a full refund or replacement under the UK Consumer Rights Act 2015. Please report any issues via our Help Center within 24 hours of delivery, attaching clear photographs.

3. Refund Processing
Approved refunds are initiated immediately to your original payment card. Depending on your UK bank or card issuer, funds typically take 3 to 5 business days to clear and appear on your statement.`
  },
  {
    id: 'cookies',
    title: 'Cookie & Tracking Policy',
    icon: 'disc',
    subtitle: 'Use of cookies and local storage for seamless browsing',
    content: `1. What Are Cookies?
Cookies and local storage tokens are small pieces of data stored on your device to remember your session, login status, and basket contents.

2. Essential Cookies
We use strictly necessary storage tokens (such as secure JWT authentication tokens and cart state) to ensure the marketplace operates reliably and securely. These cannot be disabled without impairing core app functionality.

3. Analytics & Performance
We use anonymised performance metrics to understand how users interact with our store categories and product listings, helping us continuously optimize app speed and usability.`
  },
  {
    id: 'merchant',
    title: 'Merchant & Partner Code',
    icon: 'briefcase',
    subtitle: 'Standards and food safety guidelines for selling partners',
    content: `1. Compliance & Licensing
All partner merchants selling on UK-MarketPlace must maintain valid UK business registrations, local authority health and safety ratings (where applicable for food and grocery items), and trading standards compliance.

2. Fair Pricing & Accuracy
Merchants agree to provide accurate item descriptions, ingredient lists, allergen information, and fair pricing consistent with their physical store or direct retail offerings.`
  }
];

export default function TermsPoliciesScreen({ navigation }) {
  const [expandedId, setExpandedId] = useState('terms'); // open terms by default

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Policies</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Legal Promo Banner - Same UI Design as AccountScreen */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Transparency & Security</Text>
            <Text style={styles.promoSubtitle}>We believe in clear, fair guidelines that protect our UK customers and merchants.</Text>
            <View style={styles.promoActionRow}>
              <Text style={styles.promoActionText}>Last Updated: July 2026 • v1.0.0</Text>
            </View>
          </View>
          <View style={styles.promoGraphicPlaceholder}>
            <MaterialCommunityIcons name="shield-check-outline" size={65} color="rgba(255,255,255,0.35)" />
            <MaterialCommunityIcons name="gavel" size={30} color="rgba(255,255,255,0.5)" style={styles.promoTicketIcon} />
          </View>
        </View>

        {/* Policy Section - Using AccountScreen General List UI Design */}
        <Text style={styles.sectionTitle}>Legal Agreements</Text>
        <View style={styles.generalList}>
          {POLICIES.map((item, index) => {
            const isExpanded = expandedId === item.id;
            return (
              <React.Fragment key={item.id}>
                <TouchableOpacity 
                  style={styles.generalItem} 
                  activeOpacity={0.7} 
                  onPress={() => toggleExpand(item.id)}
                >
                  <View style={styles.generalItemLeft}>
                    <View style={[styles.iconBox, { backgroundColor: isExpanded ? '#F3E8FF' : '#F3F4F6' }]}>
                      <Feather 
                        name={item.icon} 
                        size={20} 
                        color={isExpanded ? Colors.primary : Colors.text} 
                      />
                    </View>
                    <View style={styles.titleContainer}>
                      <Text style={[styles.generalItemText, isExpanded && styles.expandedTitleText]}>
                        {item.title}
                      </Text>
                      <Text style={styles.subtitleText} numberOfLines={isExpanded ? undefined : 1}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>
                  <Feather 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={isExpanded ? Colors.primary : Colors.muted} 
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.contentContainer}>
                    <Text style={styles.contentText}>{item.content}</Text>
                  </View>
                )}

                {index < POLICIES.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Legal Footer */}
        <Text style={styles.footerText}>
          UK-MarketPlace Ltd. is registered in England & Wales.{"\n"}
          For legal inquiries, contact legal@uk-marketplace.co.uk
        </Text>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  headerIconBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRightPlaceholder: {
    width: 32,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },

  /* Promo Banner (Matches AccountScreen) */
  promoBanner: {
    backgroundColor: '#1E293B', // Sleek dark slate for legal authority while matching promo banner layout
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
    marginBottom: 6,
  },
  promoSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: Typography.size.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  promoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoActionText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  promoGraphicPlaceholder: {
    position: 'absolute',
    right: -15,
    bottom: -15,
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  promoTicketIcon: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    transform: [{ rotate: '-15deg' }]
  },

  /* Section Titles */
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  /* General List (Matches AccountScreen) */
  generalList: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  generalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  generalItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  generalItemText: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  expandedTitleText: {
    color: Colors.primary,
  },
  subtitleText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  contentContainer: {
    paddingLeft: 54,
    paddingRight: Spacing.sm,
    paddingBottom: 20,
    paddingTop: 8,
  },
  contentText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 54,
  },

  /* Footer */
  footerText: {
    textAlign: 'center',
    fontSize: Typography.size.sm,
    color: Colors.muted,
    lineHeight: 20,
    marginBottom: Spacing['2xl'],
  },
});
