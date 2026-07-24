import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { getStoreStatus } from '../api/stores.api';
import { useCustomAlert } from '../context/AlertContext';

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

function CartItem({ item, onUpdate, onRemove, navigation }) {
  const [updating, setUpdating] = useState(false);

  const handleIncrement = async () => {
    setUpdating(true);
    await onUpdate(item._id, item.quantity + 1);
    setUpdating(false);
  };

  const handleDecrement = async () => {
    setUpdating(true);
    if (item.quantity > 1) {
      await onUpdate(item._id, item.quantity - 1);
    } else {
      await onRemove(item._id);
    }
    setUpdating(false);
  };

  const handleRemove = async () => {
    setUpdating(true);
    await onRemove(item._id);
    setUpdating(false);
  };

  const imageUrl = item.image || item.product?.images?.[0] || 'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';
  const unitPrice = item.unitPrice ?? item.price ?? 0;
  const price = ((unitPrice * item.quantity) / 100).toFixed(2);
  const originalPrice = item.compareAtPrice ? ((item.compareAtPrice * item.quantity) / 100).toFixed(2) : null;

  return (
    <View style={styles.cartItemRow}>
      <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { product: { _id: item.product, title: item.title, price: item.unitPrice, images: item.image ? [item.image] : [] } })}>
        <Image source={{ uri: imageUrl }} style={styles.itemImage} />
      </TouchableOpacity>

      <View style={styles.itemDetails}>
        <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { product: { _id: item.product, title: item.title, price: item.unitPrice, images: item.image ? [item.image] : [] } })}>
          <Text style={styles.itemName} numberOfLines={2}>{item.title || item.product?.title || 'Product'}</Text>
        </TouchableOpacity>

        <View style={styles.controlsRow}>
          <View style={styles.quantityControl}>
            <TouchableOpacity onPress={handleDecrement} disabled={updating} style={styles.qtyBtn}>
              {item.quantity === 1 ? (
                <Feather name="trash-2" size={16} color={Colors.text} />
              ) : (
                <Feather name="minus" size={16} color={Colors.text} />
              )}
            </TouchableOpacity>

            <Text style={styles.qtyText}>
              {updating ? <ActivityIndicator size="small" /> : item.quantity}
            </Text>

            <TouchableOpacity onPress={handleIncrement} disabled={updating} style={styles.qtyBtn}>
              <Feather name="plus" size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.itemPrice}>£{price}</Text>
            {originalPrice && (
              <Text style={styles.itemOriginalPrice}>£{originalPrice}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function BasketScreen({ navigation }) {
  const { items, total, subtotal, shippingFee, itemCount, storeId, defaultShippingMethod, updateItem, removeItem, isLoading } = useCart();
  const { showAlert } = useCustomAlert();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const insets = useSafeAreaInsets();

  let deliveryTimeText = '10 - 25 min';
  if (defaultShippingMethod) {
    if (defaultShippingMethod.minDays === 0 && defaultShippingMethod.maxDays === 0) {
      deliveryTimeText = 'Today';
    } else if (defaultShippingMethod.minDays === defaultShippingMethod.maxDays) {
      deliveryTimeText = `${defaultShippingMethod.minDays} min${defaultShippingMethod.minDays !== 1 ? 's' : ''}`;
    } else {
      deliveryTimeText = `${defaultShippingMethod.minDays} - ${defaultShippingMethod.maxDays} mins`;
    }
  }

  // Dummy store name, ideally fetched from cart context
  const storeName = items[0]?.product?.store?.name || 'Snappy Store';

  const totalInPounds = (total / 100).toFixed(2);
  const subtotalInPounds = (subtotal / 100).toFixed(2);
  const shippingFeeInPounds = (shippingFee / 100).toFixed(2);

  const originalSubtotal = items.reduce((acc, item) => {
    const unitPrice = item.unitPrice ?? item.price ?? 0;
    const comparePrice = item.compareAtPrice && item.compareAtPrice > unitPrice ? item.compareAtPrice : unitPrice;
    return acc + (comparePrice * item.quantity);
  }, 0);
  
  const hasDiscount = originalSubtotal > subtotal;
  const originalTotal = hasDiscount ? ((originalSubtotal + shippingFee) / 100).toFixed(2) : null;

  const handleCheckout = async () => {
    if (!storeId) return;
    setIsCheckingOut(true);
    try {
      const res = await getStoreStatus(storeId);
      const statusData = res?.data ?? res;
      if (statusData && statusData.isOpen === false) {
        showAlert({
          title: 'Store Closed',
          message: `Sorry, this store is currently closed. ${statusData.statusLabel || ''}`,
          icon: 'clock',
          showCancel: false,
          confirmText: 'Okay',
        });
        setIsCheckingOut(false);
        return;
      }

      // Proceed with checkout logic
      navigation.navigate('Checkout');
    } catch (err) {
      console.log('Error checking store status', err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (itemCount === 0) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}>Cart</Text>
              <Text style={styles.headerSubtitle}>{storeName}</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={styles.emptyContent}>
          <View style={styles.iconWrapper}>
            <View style={styles.cartIcon}>
              <View style={[styles.cartHandle, { borderColor: Colors.muted }]} />
              <View style={[styles.cartBody, { backgroundColor: Colors.border }]} />
            </View>
          </View>
          <Text style={styles.title}>Your basket is empty</Text>
          <Text style={styles.subtitle}>Browse stores and add items to get started</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Cart</Text>
            <Text style={styles.headerSubtitle}>{storeName}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLineBackground} />
          <View style={[styles.progressLineFill, { width: '50%' }]} />
          <View style={styles.progressStepsRow}>
            <ProgressStep step={1} currentStep={2} label="Menu" />
            <ProgressStep step={2} currentStep={2} label="Cart" />
            <ProgressStep step={3} currentStep={2} label="Checkout" isLast />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Delivery Info */}
        <View style={styles.deliveryInfoRow}>
          <Text style={styles.deliveryInfoText}>
            Delivery: <Text style={{ fontWeight: '800' }}>{deliveryTimeText}</Text>
          </Text>
        </View>

        {/* Cart Items */}
        <View style={styles.itemsSection}>
          {items.map(item => (
            <CartItem
              key={item._id}
              item={item}
              onUpdate={updateItem}
              onRemove={removeItem}
              navigation={navigation}
            />
          ))}

          <TouchableOpacity style={styles.addMoreRow} onPress={() => navigation.goBack()}>
            <Feather name="plus" size={20} color={Colors.text} />
            <Text style={styles.addMoreText}>Add more items</Text>
          </TouchableOpacity>
        </View>

        {/* Total Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summarySubLabel}>Items Subtotal</Text>
            <Text style={styles.summarySubPrice}>£{subtotalInPounds}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summarySubLabel}>Delivery Fee</Text>
            <Text style={styles.summarySubPrice}>£{shippingFeeInPounds}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <View>
              <Text style={styles.summaryTotalLabel}>Total <Text style={styles.summaryTaxLabel}>(incl. tax)</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryTotalPrice}>£{totalInPounds}</Text>
              {originalTotal && <Text style={styles.summaryOriginalPrice}>£{originalTotal}</Text>}
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.bottomFooter}>
          <TouchableOpacity
            style={styles.confirmBtn}
            activeOpacity={0.8}
            onPress={handleCheckout}
            disabled={isCheckingOut}
          >
            {isCheckingOut ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm payment and address</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: {
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    justifyContent: 'space-between'
  },
  closeBtn: {
    padding: Spacing.xs,
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

  scrollContent: {
    paddingBottom: Spacing.xl + 40, // add more space so the button doesn't get hidden behind bottom tabs
  },

  // Toggle Switch
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: '#E5E7EB',
    borderRadius: Radius.full,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
    gap: 8,
  },
  toggleBtnActive: {
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  toggleText: {
    fontWeight: '600',
    color: Colors.muted,
  },
  toggleTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },

  // Delivery Info
  deliveryInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  deliveryInfoText: {
    fontSize: 15,
    color: Colors.text,
  },
  changeText: {
    fontSize: 15,
    color: Colors.text,
    textDecorationLine: 'underline',
  },

  // Items
  itemsSection: {
    backgroundColor: Colors.white,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cartItemRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
  },
  itemDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: Radius.full,
  },
  qtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#D81B60', // Pink matching figma
  },
  itemOriginalPrice: {
    fontSize: 13,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  addMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  addMoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },

  // Summary
  summarySection: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  summarySubLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  summarySubPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  summaryTaxLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.muted,
  },
  seeSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  summaryTotalPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D81B60',
  },
  summaryOriginalPrice: {
    fontSize: 13,
    color: Colors.muted,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },

  // Footer
  bottomFooter: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  confirmBtn: {
    backgroundColor: '#D81B60', // Pink from figma
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: Colors.white,
    fontSize: 16, // matches Typography.subtitle1
    fontWeight: '600',
  },

  // Empty state
  emptyContent: {
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
  cartIcon: { alignItems: 'center' },
  cartHandle: {
    width: 20, height: 12, borderWidth: 3, borderBottomWidth: 0, borderRadius: 10, marginBottom: -2,
  },
  cartBody: {
    width: 28, height: 18, borderRadius: 4, borderTopLeftRadius: 1, borderTopRightRadius: 1,
  },
  title: {
    fontSize: Typography.size.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.sm, color: Colors.muted, textAlign: 'center', lineHeight: 20,
  },
});
