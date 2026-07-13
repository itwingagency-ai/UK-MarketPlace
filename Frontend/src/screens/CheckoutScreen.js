import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, FontAwesome } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { previewCheckout, placeOrder, cancelTransaction, confirmTransaction } from '../api/checkout.api';
import { useCart } from '../context/CartContext';
import { useCustomAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';

// Progress Step component
function ProgressStep({ step, currentStep, label, isLast }) {
  const isActive = step === currentStep;
  const isPast = step < currentStep;
  const color = isActive || isPast ? '#333' : '#D1D5DB';
  const bgColor = isActive ? '#333' : (isPast ? '#333' : '#FFF');
  const textColor = isActive || isPast ? '#FFF' : '#6B7280';

  return (
    <View style={styles.stepWrapper}>
      <View style={[styles.stepCircle, { backgroundColor: bgColor, borderColor: color }]}>
        {isPast ? (
          <Feather name="check" size={14} color="#FFF" />
        ) : (
          <Text style={[styles.stepNumber, { color: textColor }]}>{step}</Text>
        )}
      </View>
      <Text style={[styles.stepLabel, { color: isActive ? '#333' : '#6B7280', fontWeight: isActive ? '700' : '500' }]}>{label}</Text>
    </View>
  );
}

export default function CheckoutScreen({ navigation }) {
  const { clearCart, fetchCart, items } = useCart();
  const { showAlert } = useCustomAlert();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { user } = useAuth();

  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const storeName = items && items[0]?.product?.store?.name ? items[0].product.store.name : 'Snappy Store';

  // Form State
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'online' or 'cod'
  const [address, setAddress] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    line1: '',
    city: '',
  });

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    try {
      const res = await previewCheckout();
      setPreviewData(res.data);
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to load checkout preview',
        icon: 'alert-circle',
      });
      navigation.goBack();
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handlePlaceOrder = async () => {
    // Basic validation
    if (!address.fullName || !address.phone || !address.line1 || !address.city) {
      showAlert({
        title: 'Missing Details',
        message: 'Please fill in all shipping address fields.',
        icon: 'alert-circle',
      });
      return;
    }

    setIsPlacingOrder(true);

    try {
      // 1. Call Backend to create order and get Stripe clientSecret
      const payload = {
        shippingAddress: {
          ...address,
          country: 'UK', // default
        },
        paymentMethod,
        clientType: 'mobile',
      };

      const res = await placeOrder(payload);
      const { payment } = res.data;

      // 2. Handle Stripe Flow if online
      if (paymentMethod === 'online' && payment && payment.clientSecret) {
        // Initialize payment sheet
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'UK MarketPlace',
          paymentIntentClientSecret: payment.clientSecret,
          allowsDelayedPaymentMethods: false,
          defaultBillingDetails: {
            name: address.fullName,
            phone: address.phone,
          },
        });

        if (initError) {
          await cancelTransaction(payment.transactionId).catch(console.log);
          await fetchCart();
          throw new Error(initError.message);
        }

        // Present payment sheet
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          await cancelTransaction(payment.transactionId).catch(console.log);
          await fetchCart();
          if (presentError.code === 'Canceled') {
            setIsPlacingOrder(false);
            return; // User canceled, don't show error
          }
          throw new Error(presentError.message);
        }
        
        // Payment successful!
        await confirmTransaction(payment.transactionId).catch(console.log);
      }

      // 3. Success cleanup
      await fetchCart(); // Refresh cart (should be empty now)
      navigation.replace('OrderSuccess', { orders: res?.data?.orders });

    } catch (err) {
      console.log('Checkout error:', err);
      showAlert({
        title: 'Checkout Failed',
        message: err.response?.data?.message || err.message || 'An error occurred during checkout',
        icon: 'alert-circle',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isLoadingPreview) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLineBackground} />
        <View style={[styles.progressLineFill, { right: Spacing.xl + 15, backgroundColor: '#333' }]} />
        <View style={styles.progressStepsRow}>
          <ProgressStep step={1} currentStep={3} label="Menu" />
          <ProgressStep step={2} currentStep={3} label="Cart" />
          <ProgressStep step={3} currentStep={3} label="Checkout" isLast />
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Shipping Address Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={address.fullName}
                onChangeText={(text) => setAddress({ ...address, fullName: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                keyboardType="phone-pad"
                value={address.phone}
                onChangeText={(text) => setAddress({ ...address, phone: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Street Address (Line 1)"
                value={address.line1}
                onChangeText={(text) => setAddress({ ...address, line1: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="City"
                value={address.city}
                onChangeText={(text) => setAddress({ ...address, city: text })}
              />
            </View>
          </View>

          {/* Payment Method Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'online' && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod('online')}
              >
                <View style={styles.paymentOptionLeft}>
                  <Ionicons 
                    name={paymentMethod === 'online' ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={paymentMethod === 'online' ? Colors.primary : Colors.border} 
                  />
                  <Text style={styles.paymentOptionText}>Credit/Debit Card</Text>
                </View>
                <Feather name="credit-card" size={20} color={Colors.textLight} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod('cod')}
              >
                <View style={styles.paymentOptionLeft}>
                  <Ionicons 
                    name={paymentMethod === 'cod' ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={paymentMethod === 'cod' ? Colors.primary : Colors.border} 
                  />
                  <Text style={styles.paymentOptionText}>Cash on Delivery</Text>
                </View>
                <FontAwesome name="gbp" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Order Summary */}
          {previewData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <View style={styles.card}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>£{(previewData.subtotal / 100).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Shipping</Text>
                  <Text style={styles.summaryValue}>£{(previewData.shippingFee / 100).toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>£{(previewData.grandTotal / 100).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.placeOrderBtn}
          onPress={handlePlaceOrder}
          disabled={isPlacingOrder || !previewData?.canCheckout}
        >
          {isPlacingOrder ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.placeOrderBtnText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  placeholder: {
    width: 32,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.subtitle1,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    ...Typography.body1,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  paymentOptionActive: {
    // Optional active style
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentOptionText: {
    ...Typography.body1,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body2,
    color: Colors.textLight,
  },
  summaryValue: {
    ...Typography.body2,
    color: Colors.text,
    fontWeight: '500',
  },
  summaryTotalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryTotalLabel: {
    ...Typography.subtitle1,
    color: Colors.text,
    fontWeight: '700',
  },
  summaryTotalValue: {
    ...Typography.subtitle1,
    color: '#D81B60', // Pink/Red color
    fontWeight: '800',
    fontSize: 18,
  },
  footer: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  placeOrderBtn: {
    backgroundColor: '#D81B60', // Pink color
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  placeOrderBtnText: {
    ...Typography.subtitle1,
    color: Colors.white,
    fontWeight: '600',
  },
  // Progress Bar
  progressContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    position: 'relative',
    height: 60,
  },
  progressLineBackground: {
    position: 'absolute',
    top: 25,
    left: Spacing.xl + 15,
    right: Spacing.xl + 15,
    height: 4,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
  },
  progressLineFill: {
    position: 'absolute',
    top: 25,
    left: Spacing.xl + 15,
    height: 4,
    backgroundColor: '#333',
    zIndex: 2,
  },
  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 60,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 11,
  },
});
