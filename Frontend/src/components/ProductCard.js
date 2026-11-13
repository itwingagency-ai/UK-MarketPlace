import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useCustomAlert } from '../context/AlertContext';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';
const STEPPER_IN = FadeIn.duration(140);

export const formatPence = (pence) => `£${(Number(pence || 0) / 100).toFixed(2)}`;

/**
 * Product tile with favourite heart and an Add button that morphs into a
 * − qty + stepper once the product is in the basket.
 * Products with variants open the detail screen to pick an option.
 */
export default function ProductCard({ product, width, onPress, onRequireLogin }) {
  const { items, addItem, updateItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { favoriteProducts, toggleFavoriteProduct } = useFavorites();
  const { showAlert } = useCustomAlert();
  const [busy, setBusy] = useState(false);

  const productId = product._id || product.id;
  // Variants the shopkeeper switched off are not for sale
  const sellableVariants = (product.variants || []).filter((v) => v.isActive !== false);
  const hasVariants = product.variants?.length > 0;
  const cartItem = !hasVariants
    ? items.find((i) => String(i.product?._id || i.product) === String(productId) && !i.variantId)
    : null;
  const quantity = cartItem?.quantity ?? 0;
  const isFavourite = favoriteProducts.some((p) => p?._id === productId || p === productId);
  const outOfStock = hasVariants
    ? !sellableVariants.some((v) => Number(v.stock) > 0)
    : Number(product.stock) <= 0;
  const onOffer = product.compareAtPrice && product.compareAtPrice > product.price;
  const discount = onOffer ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;

  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const requireLogin = (type) => {
    if (onRequireLogin) onRequireLogin(type);
  };

  const showError = (message) =>
    showAlert({ title: "Couldn't update basket", message, icon: 'alert-circle', showCancel: false, confirmText: 'OK' });

  const changeQuantity = async (next) => {
    if (busy) return;
    if (!isAuthenticated) return requireLogin('cart');
    if (hasVariants) return onPress?.();
    setBusy(true);
    pop.value = withSequence(withSpring(1.18, Motion.springs.bouncy), withSpring(1, Motion.springs.snappy));
    const res = cartItem ? await updateItem(cartItem._id, next) : await addItem(productId, 1);
    setBusy(false);
    if (!res.success) showError(res.error);
  };

  const toggleFavourite = () => {
    if (!isAuthenticated) return requireLogin('favourite');
    heart.value = withSequence(withSpring(1.3, Motion.springs.bouncy), withSpring(1, Motion.springs.snappy));
    toggleFavoriteProduct(productId);
  };

  return (
    <Animated.View style={[{ width }, pressStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { press.value = withSpring(0.97, Motion.springs.snappy); }}
        onPressOut={() => { press.value = withSpring(1, Motion.springs.snappy); }}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${product.title}, ${formatPence(product.price)}`}
      >
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.images?.[0] || PLACEHOLDER }} style={styles.image} resizeMode="cover" />
          {onOffer ? (
            <View style={styles.discount}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          ) : null}
          <Pressable onPress={toggleFavourite} hitSlop={8} style={styles.heart}>
            <Animated.View style={heartStyle}>
              <Ionicons
                name={isFavourite ? 'heart' : 'heart-outline'}
                size={17}
                color={isFavourite ? Colors.accent : Colors.text}
              />
            </Animated.View>
          </Pressable>
          {outOfStock ? (
            <View style={styles.soldOut}>
              <Text style={styles.soldOutText}>Out of stock</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
          {hasVariants ? (
            <Text style={styles.options} numberOfLines={1}>
              {sellableVariants.length} {sellableVariants.length === 1 ? 'option' : 'options'}
            </Text>
          ) : product.size ? (
            <Text style={styles.size} numberOfLines={1}>{product.size}</Text>
          ) : null}

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.price}>
                {hasVariants && sellableVariants.length > 1 ? <Text style={styles.from}>from </Text> : null}
                {formatPence(product.price)}
              </Text>
              {onOffer ? <Text style={styles.compare}>{formatPence(product.compareAtPrice)}</Text> : null}
            </View>

            {quantity > 0 ? (
              <Animated.View entering={STEPPER_IN} style={styles.stepper}>
                <Pressable onPress={() => changeQuantity(quantity - 1)} hitSlop={6} style={styles.stepBtn}>
                  <Feather name={quantity === 1 ? 'trash-2' : 'minus'} size={15} color={Colors.white} />
                </Pressable>
                <Animated.Text style={[styles.qty, popStyle]}>{quantity}</Animated.Text>
                <Pressable
                  onPress={() => changeQuantity(quantity + 1)}
                  hitSlop={6}
                  style={styles.stepBtn}
                  disabled={Number(product.stock) <= quantity}
                >
                  <Feather name="plus" size={15} color={Colors.white} />
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View style={popStyle}>
                <Pressable
                  onPress={() => changeQuantity(1)}
                  disabled={outOfStock}
                  style={[styles.addBtn, outOfStock && styles.addBtnDisabled]}
                  accessibilityLabel={`Add ${product.title} to basket`}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Feather name={hasVariants ? 'chevron-right' : 'plus'} size={18} color={Colors.white} />
                  )}
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  imageWrap: {
    height: 132,
    backgroundColor: Colors.surfaceSecondary,
  },
  image: { width: '100%', height: '100%' },
  discount: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  discountText: {
    fontFamily: Typography.family.bold,
    fontSize: 11,
    color: Colors.white,
  },
  heart: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  soldOutText: {
    fontFamily: Typography.family.bold,
    fontSize: 12,
    color: Colors.text,
  },
  body: {
    padding: Spacing.md,
  },
  title: {
    fontFamily: Typography.family.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.text,
    minHeight: 38,
  },
  options: {
    fontFamily: Typography.family.medium,
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  size: {
    fontFamily: Typography.family.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  from: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
  price: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 17,
    color: Colors.text,
  },
  compare: {
    fontFamily: Typography.family.regular,
    fontSize: 12,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    ...Shadow.morphic3d,
  },
  addBtnDisabled: {
    backgroundColor: Colors.muted,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    minWidth: 20,
    textAlign: 'center',
    fontFamily: Typography.family.bold,
    fontSize: 14,
    color: Colors.white,
  },
});
