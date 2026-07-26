import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { Colors, Spacing, Typography, Radius } from '../theme';

const FAQ_ITEMS = [
  {
    id: '1',
    category: 'Orders & Delivery',
    question: 'How do I confirm that my order is placed?',
    answer: 'Once your order is placed, you will receive a confirmation email'
  },
  {
    id: '2',
    category: 'Orders & Delivery',
    question: 'How do I change my delivery address?',
    answer: 'If your order has not been dispatched yet, please contact our support team immediately with your order number.'
  },
  {
    id: '4',
    category: 'Payments & Refunds',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major debit and credit cards (Visa, Mastercard, American Express) as well as Apple Pay and Google Pay'
  },
  {
    id: '5',
    category: 'General',
    question: 'What if an item is missing or damaged?',
    answer: 'We take quality very seriously. If any item in your delivery arrives damaged or is missing, please contact support within 24 hours'
  }
];

export default function HelpCenterScreen({ navigation }) {
  const [expandedId, setExpandedId] = useState(null);
  const [supportEmail, setSupportEmail] = useState('superadmin@marketplace.co.uk');
  const [supportPhone, setSupportPhone] = useState('+44 20 7946 0921');

  useEffect(() => {
    let isMounted = true;
    const fetchSupportContact = async () => {
      try {
        const cachedEmail = await AsyncStorage.getItem('@platform_support_email');
        const cachedPhone = await AsyncStorage.getItem('@platform_support_phone');
        if (isMounted && cachedEmail) setSupportEmail(cachedEmail);
        if (isMounted && cachedPhone) setSupportPhone(cachedPhone);

        const res = await client.get('/platform/settings');
        const data = res.data?.data || res.data;
        if (data && isMounted) {
          const newEmail = data.supportEmail || cachedEmail || 'superadmin@marketplace.co.uk';
          const newPhone = data.supportPhone || cachedPhone || '+44 20 7946 0921';

          if (newEmail !== cachedEmail) {
            setSupportEmail(newEmail);
            await AsyncStorage.setItem('@platform_support_email', newEmail);
          }
          if (newPhone !== cachedPhone) {
            setSupportPhone(newPhone);
            await AsyncStorage.setItem('@platform_support_phone', newPhone);
          }
        }
      } catch (err) {
        console.log('Error loading support contact:', err);
      }
    };
    fetchSupportContact();
    return () => { isMounted = false; };
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleContactAction = (type) => {
    if (type === 'email') {
      Linking.openURL(`mailto:${supportEmail}?subject=Support%20Request`);
    } else if (type === 'call') {
      Linking.openURL(`tel:${supportPhone}`);
    }
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
          <Text style={styles.headerTitle}>Help Center</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Support Promo Banner - Same UI Design as AccountScreen */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>How Can We Help You Today?</Text>
            <Text style={styles.promoSubtitle}>Our support team is available for all your order and account needs.</Text>
          </View>
          <View style={styles.promoGraphicPlaceholder}>
            <MaterialCommunityIcons name="headset" size={65} color="rgba(255,255,255,0.35)" />
            <MaterialCommunityIcons name="message-text-outline" size={30} color="rgba(255,255,255,0.5)" style={styles.promoTicketIcon} />
          </View>
        </View>

        {/* Action Grid - Same UI Design as AccountScreen */}
        <Text style={styles.sectionTitle}>Get in Touch</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7} onPress={() => handleContactAction('email')}>
            <Feather name="mail" size={28} color={Colors.text} />
            <Text style={styles.actionCardText}>Email Us</Text>
            <Text style={styles.actionCardSubtext} numberOfLines={1}>{supportEmail}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7} onPress={() => handleContactAction('call')}>
            <Ionicons name="call-outline" size={28} color={Colors.text} />
            <Text style={styles.actionCardText}>Call Support</Text>
            <Text style={styles.actionCardSubtext} numberOfLines={1}>{supportPhone}</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ Section - Using AccountScreen General List UI Design */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Frequently Asked Questions</Text>
        <View style={styles.generalList}>
          {FAQ_ITEMS.map((item, index) => {
            const isExpanded = expandedId === item.id;
            return (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  style={styles.generalItem}
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(item.id)}
                >
                  <View style={styles.generalItemLeft}>
                    <Feather
                      name={isExpanded ? "help-circle" : "help-circle"}
                      size={22}
                      color={isExpanded ? Colors.primary : Colors.text}
                    />
                    <View style={styles.questionContainer}>
                      <Text style={styles.categoryText}>{item.category}</Text>
                      <Text style={[styles.generalItemText, isExpanded && styles.expandedQuestionText]}>
                        {item.question}
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
                  <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{item.answer}</Text>
                  </View>
                )}

                {index < FAQ_ITEMS.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Support Hours Footer */}
        <Text style={styles.footerText}>Support Hours: Monday — Sunday (24 Hours){"\n"}Support Line: {supportPhone}</Text>
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
    marginBottom: 6,
  },
  promoSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: Typography.size.sm,
    lineHeight: 20,
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
    bottom: 20,
    right: 25,
    transform: [{ rotate: '-15deg' }]
  },

  /* Action Grid (Matches AccountScreen) */
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
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
  actionCardSubtext: {
    marginTop: 4,
    fontSize: Typography.size.xs,
    color: Colors.muted,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
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
  questionContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  generalItemText: {
    fontSize: Typography.size.base,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 22,
  },
  expandedQuestionText: {
    color: Colors.primary,
  },
  answerContainer: {
    paddingLeft: 38,
    paddingRight: Spacing.sm,
    paddingBottom: 16,
    paddingTop: 4,
  },
  answerText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 38,
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
