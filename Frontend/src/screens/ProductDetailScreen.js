import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useCustomAlert } from '../context/AlertContext';
import { getProductReviews } from '../api/reviews.api';
import { createStockAlert, deleteStockAlert, getProductById, getStockAlerts } from '../api/products.api';
import { useLiveEvent } from '../context/NotificationsContext';
import { formatPence } from '../components/ProductCard';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';
const HERO_HEIGHT = 360;

// Entrance animations are built once: a new builder per render remounts views.
const SHEET_IN = FadeInDown.delay(80).springify().damping(Motion.springs.gentle.damping);
const BAR_IN = FadeInDown.delay(200).springify().damping(Motion.springs.gentle.damping);
const ADDED_IN = FadeIn.duration(200);

function Stars({ value, size = 13 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={Colors.warning}
        />
      ))}
    </View>
  );
}

export default function ProductDetailScreen({ route, navigation }) {
  const { product: initialProduct, store } = route.params;
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState(initialProduct);
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { favoriteProducts, toggleFavoriteProduct } = useFavorites();
  const { showAlert } = useCustomAlert();

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState([]);

  const productId = product?._id || product?.id;
  const isFavourite = favoriteProducts.some((p) => p?._id === productId || p === productId);

  // Coming from the basket or a notification we only have a summary — load the full product.
  const reloadProduct = () =>
    getProductById(productId).then((res) => res.data && setProduct(res.data)).catch(() => {});
  useEffect(() => {
    if (productId && !product.description) reloadProduct();
  }, [productId, product.description]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Back in stock" for this product: show the new stock straight away
  useLiveEvent('app:notification', (n) => {
    if (n?.data?.type === 'stock:back' && n.data.productId === String(productId)) {
      reloadProduct();
      setAlerts(new Set());
    }
  });

  useEffect(() => {
    if (!productId) return;
    getProductReviews(productId, { limit: 3 })
      .then((res) => setReviews(res?.data ?? []))
      .catch(() => {});
  }, [productId]);

  // Options are derived from variant attributes, e.g. { Size: ['400g', '800g'] }.
  const variants = useMemo(() => (product.variants || []).filter((v) => v.isActive !== false), [product.variants]);
  const optionGroups = useMemo(() => {
    const groups = {};
    variants.forEach((v) => {
      Object.entries(v.attributes || {}).forEach(([name, value]) => {
        groups[name] = groups[name] || [];
        if (!groups[name].includes(value)) groups[name].push(value);
      });
    });
    return groups;
  }, [variants]);
  // Start on the first option that can actually be bought
  const [selection, setSelection] = useState(
    () => (variants.find((v) => Number(v.stock) > 0) || variants[0])?.attributes || {}
  );
  const selectedVariant = variants.find((v) =>
    Object.entries(selection).every(([k, val]) => v.attributes?.[k] === val)
  );

  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant ? selectedVariant.compareAtPrice : product.compareAtPrice;
  // A product with options is only sellable through one of them
  const hasVariants = (product.variants || []).length > 0;
  const stock = hasVariants ? Number(selectedVariant?.stock ?? 0) : Number(product.stock ?? 0);
  const onOffer = compareAt && compareAt > price;
  const imageUrl = selectedVariant?.images?.[0] || product.images?.[0] || PLACEHOLDER;
  const rating = Number(product.averageRating || 0);

  // "Notify me when back": which sizes ('' = whole product) this customer is waiting on
  const [alerts, setAlerts] = useState(new Set());
  const [alertBusy, setAlertBusy] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || !productId) return;
    getStockAlerts(productId)
      .then((res) => setAlerts(new Set((res.data || []).map((a) => String(a.variantId || '')))))
      .catch(() => {});
  }, [isAuthenticated, productId]);
  const alertKey = String(selectedVariant?._id || '');
  const waiting = alerts.has(alertKey);

  const toggleAlert = async () => {
    if (!isAuthenticated) return requireLogin('alert');
    setAlertBusy(true);
    try {
      if (waiting) await deleteStockAlert(productId, selectedVariant?._id);
      else await createStockAlert(productId, selectedVariant?._id);
      setAlerts((prev) => {
        const next = new Set(prev);
        if (waiting) next.delete(alertKey);
        else next.add(alertKey);
        return next;
      });
    } catch (err) {
      showAlert({ title: "Couldn't update", message: err.response?.data?.message || 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setAlertBusy(false);
    }
  };

  // Keep the chosen quantity within what the selected option has left
  useEffect(() => {
    setQuantity((q) => Math.max(1, Math.min(q, stock)));
  }, [stock]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, HERO_HEIGHT], [0, HERO_HEIGHT * 0.4], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-150, 0], [1.3, 1], Extrapolation.CLAMP) },
    ],
  }));
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const requireLogin = (type) =>
    showAlert({
      title: type === 'cart' ? 'Log in to add to basket' : type === 'alert' ? 'Log in to get notified' : 'Log in to save favourites',
      message: 'Create an account or log in to keep shopping.',
      icon: type === 'cart' ? 'shopping-bag' : 'heart',
      confirmText: 'Log in',
      onConfirm: () => navigation.navigate('Login'),
    });

  const handleFavourite = () => {
    if (!isAuthenticated) return requireLogin('favourite');
    toggleFavoriteProduct(productId);
  };

  const handleAdd = async () => {
    if (adding) return;
    if (!isAuthenticated) return requireLogin('cart');
    if (variants.length && !selectedVariant) {
      showAlert({ title: 'Choose an option', message: 'Pick an option before adding to your basket.', showCancel: false, confirmText: 'OK' });
      return;
    }
    setAdding(true);
    const res = await addItem(productId, quantity, selectedVariant?._id ?? null);
    setAdding(false);
    if (!res.success) {
      showAlert({ title: "Couldn't add to basket", message: res.error, icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
      return;
    }
    pop.value = withSequence(withSpring(1.06, Motion.springs.bouncy), withSpring(1, Motion.springs.snappy));
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2200);
  };

  const description = product.description || '';
  const longDescription = description.length > 140;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Animated.View style={[styles.hero, heroStyle]}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: HERO_HEIGHT - 32, paddingBottom: insets.bottom + 120 }}
      >
        <Animated.View entering={SHEET_IN} style={styles.sheet}>
          {store?.name ? <Text style={styles.storeName}>{store.name}</Text> : null}
          <Text style={styles.title}>{product.title}</Text>
          {product.size && !hasVariants ? <Text style={styles.size}>{product.size}</Text> : null}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPence(price)}</Text>
            {onOffer ? (
              <>
                <Text style={styles.compare}>{formatPence(compareAt)}</Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>Save {formatPence(compareAt - price)}</Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.badgesRow}>
            <View style={[styles.stockPill, stock <= 0 && styles.stockPillOut]}>
              <View style={[styles.dot, stock <= 0 && styles.dotOut]} />
              <Text style={[styles.stockText, stock <= 0 && styles.stockTextOut]}>
                {stock <= 0 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : 'In stock'}
              </Text>
            </View>
            {rating > 0 ? (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={12} color={Colors.warning} />
                <Text style={styles.ratingText}>{rating.toFixed(1)} ({product.ratingCount})</Text>
              </View>
            ) : null}
          </View>

          {Object.entries(optionGroups).map(([name, values]) => (
            <View key={name} style={styles.optionBlock}>
              <Text style={styles.sectionLabel}>{name}</Text>
              <View style={styles.optionRow}>
                {values.map((value) => {
                  const active = selection[name] === value;
                  const variant = variants.find((v) => v.attributes?.[name] === value);
                  const soldOut = variant && Number(variant.stock) <= 0;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setSelection((prev) => ({ ...prev, [name]: value }))}
                      style={[styles.option, active && styles.optionActive, soldOut && styles.optionSoldOut]}
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${value}${soldOut ? ', sold out' : ''}`}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive, soldOut && styles.optionTextSoldOut]}>{value}</Text>
                      {variant ? (
                        <Text style={[styles.optionPrice, active && styles.optionTextActive]}>
                          {soldOut ? 'Sold out' : formatPence(variant.price)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {description ? (
            <View style={styles.block}>
              <Text style={styles.sectionLabel}>About this product</Text>
              <Text style={styles.description} numberOfLines={expanded ? undefined : 3}>{description}</Text>
              {longDescription ? (
                <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
                  <Text style={styles.readMore}>{expanded ? 'Show less' : 'Read more'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.block}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionLabel}>Reviews</Text>
              {rating > 0 ? <Stars value={rating} /> : null}
            </View>
            {reviews.length === 0 ? (
              <View style={styles.noReviews}>
                <Feather name="message-circle" size={18} color={Colors.muted} />
                <Text style={styles.noReviewsText}>No reviews yet — customers can review after delivery.</Text>
              </View>
            ) : (
              reviews.map((review) => (
                <View key={review._id} style={styles.review}>
                  <View style={styles.reviewTop}>
                    <Text style={styles.reviewer}>{review.customer?.name || review.user?.name || 'Customer'}</Text>
                    <Stars value={review.rating} size={11} />
                  </View>
                  {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
                  {review.body ? <Text style={styles.reviewBody} numberOfLines={3}>{review.body}</Text> : null}
                </View>
              ))
            )}
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Floating controls */}
      <View style={[styles.controls, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Pressable onPress={handleFavourite} style={styles.circleBtn} accessibilityLabel="Favourite">
          <Ionicons name={isFavourite ? 'heart' : 'heart-outline'} size={20} color={isFavourite ? Colors.accent : Colors.text} />
        </Pressable>
      </View>

      {/* Sticky add bar */}
      <Animated.View entering={BAR_IN} style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        {justAdded ? (
          <Animated.View entering={ADDED_IN} style={styles.addedRow}>
            <Feather name="check-circle" size={18} color={Colors.successText} />
            <Text style={styles.addedText}>Added to basket</Text>
            <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'BasketTab' })} hitSlop={8}>
              <Text style={styles.addedLink}>View basket</Text>
            </Pressable>
          </Animated.View>
        ) : null}
        {stock <= 0 ? (
          // Sold out: let the customer ask to be told when it's back
          <Pressable
            onPress={toggleAlert}
            disabled={alertBusy}
            style={[styles.addBtn, waiting && styles.notifyOnBtn]}
            accessibilityRole="button"
          >
            {alertBusy ? (
              <ActivityIndicator color={waiting ? Colors.primary : Colors.white} />
            ) : (
              <>
                <Feather name={waiting ? 'check' : 'bell'} size={18} color={waiting ? Colors.primary : Colors.white} />
                <Text style={[styles.addText, waiting && { color: Colors.primary }]}>
                  {waiting ? "We'll notify you · Undo" : 'Notify me when back'}
                </Text>
              </>
            )}
          </Pressable>
        ) : (
        <View style={styles.barRow}>
          <View style={styles.stepper}>
            <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.stepBtn} hitSlop={6}>
              <Feather name="minus" size={18} color={Colors.text} />
            </Pressable>
            <Text style={styles.qty}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(Math.max(stock, 1), q + 1))}
              style={styles.stepBtn}
              hitSlop={6}
            >
              <Feather name="plus" size={18} color={Colors.text} />
            </Pressable>
          </View>
          <Animated.View style={[{ flex: 1 }, popStyle]}>
            <Pressable
              onPress={handleAdd}
              disabled={stock <= 0 || adding}
              style={[styles.addBtn, stock <= 0 && styles.addBtnDisabled]}
            >
              {adding ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Feather name="shopping-bag" size={18} color={Colors.white} />
                  <Text style={styles.addText}>
                    {stock <= 0 ? 'Out of stock' : `Add · ${formatPence(price * quantity)}`}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    backgroundColor: Colors.surfaceSecondary,
  },
  sheet: {
    minHeight: 520,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  storeName: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.primary,
    marginBottom: 6,
  },
  title: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: Colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  price: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 28,
    color: Colors.text,
  },
  compare: {
    fontFamily: Typography.family.regular,
    fontSize: 16,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  saveBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorBg,
  },
  saveText: {
    fontFamily: Typography.family.bold,
    fontSize: 12,
    color: Colors.errorText,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
  },
  stockPillOut: { backgroundColor: Colors.errorBg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  dotOut: { backgroundColor: Colors.error },
  stockText: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.successText },
  stockTextOut: { color: Colors.errorText },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.warningBg,
  },
  ratingText: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.text },
  optionBlock: { marginTop: Spacing.lg },
  sectionLabel: {
    fontFamily: Typography.family.display,
    fontSize: 16,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: {
    minWidth: 96,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  optionText: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text },
  optionPrice: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  optionTextActive: { color: Colors.primary },
  optionSoldOut: { borderStyle: 'dashed', backgroundColor: Colors.surfaceSecondary },
  optionTextSoldOut: { color: Colors.muted, textDecorationLine: 'line-through' },
  size: {
    fontFamily: Typography.family.medium,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  block: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  description: {
    fontFamily: Typography.family.regular,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
  },
  readMore: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.primary, marginTop: Spacing.xs },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noReviews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  noReviewsText: { flex: 1, fontFamily: Typography.family.regular, fontSize: 13, color: Colors.textSecondary },
  review: {
    padding: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text },
  reviewTitle: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text, marginTop: 6 },
  reviewBody: { fontFamily: Typography.family.regular, fontSize: 13, lineHeight: 19, color: Colors.textSecondary, marginTop: 4 },
  controls: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    ...Shadow.md,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    ...Shadow.xl,
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.successBg,
  },
  addedText: { flex: 1, fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.successText },
  addedLink: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.primary },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 4,
  },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center', fontFamily: Typography.family.bold, fontSize: 17, color: Colors.text },
  addBtn: {
    height: 54,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    ...Shadow.morphic3d,
  },
  addBtnDisabled: { backgroundColor: Colors.muted },
  notifyOnBtn: { backgroundColor: Colors.primarySubtle, borderWidth: 1.5, borderColor: Colors.primaryLight },
  addText: { fontFamily: Typography.family.bold, fontSize: 16, color: Colors.white },
});
