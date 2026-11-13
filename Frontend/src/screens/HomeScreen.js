import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  StatusBar,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { getNearbyStores, decodePostcode } from '../api/stores.api';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useCart } from '../context/CartContext';
import { useCustomAlert } from '../context/AlertContext';
import Asset3D from '../components/Asset3D';
import Button from '../components/Button';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';

// Built once at module level: a new builder on every render makes Reanimated
// remount the view, which would drop focus from the postcode input.
const enter = (delay) => FadeInDown.delay(delay).springify().damping(Motion.springs.gentle.damping);
const ENTER = { top: enter(0), headline: enter(120), card: enter(220), trust: enter(320) };
const HERO_FADE = FadeIn.delay(150).duration(500);

// ─── "No stores yet" bottom sheet ────────────────────────────────────────────
function NoStoresSheet({ visible, postcode, onClose }) {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInDown.springify().damping(20)} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Asset3D name="illo-no-stores" size={84} float style={styles.sheetArt} />
          <Text style={styles.sheetTitle}>No stores here yet</Text>
          {postcode ? (
            <View style={styles.sheetPostcode}>
              <Feather name="map-pin" size={13} color={Colors.primary} />
              <Text style={styles.sheetPostcodeText}>{postcode}</Text>
            </View>
          ) : null}
          <Text style={styles.sheetBody}>
            We're bringing local stores to more neighbourhoods every week. Try a nearby postcode in the meantime.
          </Text>
          <Button title="Try another postcode" size="full" onPress={onClose} />
          <Button title="Dismiss" variant="ghost" size="full" onPress={onClose} style={{ marginTop: Spacing.xs }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { updateLocation } = useLocation();
  const [postcode, setPostcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showNoStores, setShowNoStores] = useState(false);
  const [notFoundPostcode, setNotFoundPostcode] = useState('');
  // Focus styling runs on the UI thread: re-rendering the input's wrapper
  // with new style props on focus makes Android drop the input's focus.
  const inputFocus = useSharedValue(0);
  const inputWrapStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(inputFocus.value, [0, 1], [Colors.border, Colors.primary]),
  }));
  const [cardBottom, setCardBottom] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The window doesn't resize for the keyboard (edge-to-edge), so slide the
  // content up just enough to keep the search card above it. A transform
  // keeps the input's layout stable, so it doesn't lose focus mid-animation.
  const keyboard = useAnimatedKeyboard();
  const liftStyle = useAnimatedStyle(() => {
    const overlap = keyboard.height.value - (windowHeight - insets.top - cardBottom) + Spacing.base;
    return { transform: [{ translateY: -Math.max(0, overlap) }] };
  });

  const { itemCount, clearCart, storeId } = useCart();
  const { showAlert } = useCustomAlert();

  const proceedToShopHome = (stores, trimmed, locationLabel, lat, lng) => {
    if (lat && lng) {
      updateLocation(trimmed, locationLabel, lat, lng);
    }
    navigation.navigate('MainTabs', {
      screen: 'ShopHomeTab',
      params: { screen: 'ShopHome', params: {
        stores,
        postcode: trimmed,
        locationLabel,
      }},
    });
  };

  const checkCartAndProceed = (stores, trimmed, locationLabel, lat, lng) => {
    if (itemCount > 0 && storeId) {
      const storeDelivers = stores.some(s => String(s.id) === String(storeId) || String(s._id) === String(storeId));
      if (!storeDelivers) {
        showAlert({
          title: 'Change Location?',
          message: 'The store in your current basket does not deliver to this new location. Changing location will clear your basket. Do you want to continue?',
          isDestructive: true,
          confirmText: 'Clear & Change',
          onConfirm: async () => {
            await clearCart();
            proceedToShopHome(stores, trimmed, locationLabel, lat, lng);
          }
        });
        return;
      }
    }
    proceedToShopHome(stores, trimmed, locationLabel, lat, lng);
  };

  const showNoStoresFor = (label) => {
    setNotFoundPostcode(label);
    setShowNoStores(true);
  };

  const executeSearch = async (trimmed) => {
    setIsSearching(true);
    try {
      // Resolve the postcode to coordinates with postcodes.io first, so store
      // discovery works without the server-side Google geocoder.
      const decoded = await decodePostcode(trimmed);
      const hasCoords = decoded?.latitude != null && decoded?.longitude != null;

      const apiData = await getNearbyStores(
        hasCoords ? { lat: decoded.latitude, lng: decoded.longitude } : { postcode: trimmed }
      ).catch(() => null);
      const stores = apiData?.data?.stores ?? apiData?.stores ?? [];

      if (stores.length === 0) {
        showNoStoresFor(trimmed);
        return;
      }

      let locationLabel = trimmed;
      const parts = [decoded?.admin_ward, decoded?.admin_district].filter(Boolean);
      if (parts.length > 0) {
        locationLabel = parts.join(', ');
      } else if (apiData?.data?.resolvedLocation?.formattedAddress) {
        locationLabel = apiData.data.resolvedLocation.formattedAddress;
      }

      const lat = hasCoords ? decoded.latitude : apiData?.data?.resolvedLocation?.lat ?? null;
      const lng = hasCoords ? decoded.longitude : apiData?.data?.resolvedLocation?.lng ?? null;
      checkCartAndProceed(stores, trimmed, locationLabel, lat, lng);
    } catch {
      showNoStoresFor(trimmed);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchPress = () => {
    if (!postcode.trim()) {
      showAlert({
        title: 'Postcode required',
        message: 'Please enter a postcode to search stores near you.',
        icon: 'map-pin',
        showCancel: false,
        confirmText: 'Got it',
      });
      return;
    }
    executeSearch(postcode.trim().toUpperCase());
  };

  const handleUseLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission denied',
          message: 'Enable location access in settings to use this feature.',
          icon: 'alert-circle',
          showCancel: false,
          confirmText: 'OK'
        });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const data = await getNearbyStores({ lat: latitude, lng: longitude });
      const stores = data?.data?.stores ?? data?.stores ?? [];

      if (stores.length === 0) {
        showNoStoresFor('your location');
        return;
      }

      checkCartAndProceed(stores, 'My Location', 'Your Location', latitude, longitude);
    } catch {
      showAlert({
        title: 'Location error',
        message: 'Unable to get your location. Please try entering a postcode.',
        icon: 'alert-triangle',
        showCancel: false,
        confirmText: 'Got it'
      });
    } finally {
      setIsLocating(false);
    }
  };

  const handleLogout = () => {
    showAlert({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      icon: 'log-out',
      isDestructive: true,
      confirmText: 'Log out',
      onConfirm: () => logout()
    });
  };

  const busy = isSearching || isLocating;
  const firstName = user?.name?.split(' ')[0];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Soft mesh-gradient backdrop */}
      <View style={[styles.blob, styles.blobViolet]} />
      <View style={[styles.blob, styles.blobRed]} />
      <View style={[styles.blob, styles.blobSky]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Animated.ScrollView
            style={liftStyle}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Top bar */}
            <Animated.View entering={ENTER.top} style={styles.topBar}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Feather name="shopping-bag" size={16} color={Colors.white} />
                </View>
                <Text style={styles.brandText}>UK Marketplace</Text>
              </View>
              {isAuthenticated ? (
                <Pressable onPress={handleLogout} style={styles.userChip} hitSlop={8}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{firstName?.[0]?.toUpperCase() || 'U'}</Text>
                  </View>
                  <Feather name="log-out" size={14} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                // Shopkeepers sign in here too — their account opens the shop app
                <Pressable
                  onPress={() => navigation.navigate('Login')}
                  style={[styles.userChip, styles.loginChip]}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Feather name="user" size={14} color={Colors.primary} />
                  <Text style={styles.loginChipText}>Log in</Text>
                </Pressable>
              )}
            </Animated.View>

            {/* 3D hero cluster */}
            <View style={styles.hero}>
              <View style={styles.heroHalo} />
              <Asset3D name="cat-bakery" size={64} float delay={300} style={[styles.heroItem, { top: 18, left: 24 }]} />
              <Asset3D name="cat-fruit-veg" size={56} float delay={900} style={[styles.heroItem, { top: 4, right: 40 }]} />
              <Asset3D name="cat-dairy-eggs" size={52} float delay={600} style={[styles.heroItem, { bottom: 18, left: 48 }]} />
              <Asset3D name="cat-drinks" size={58} float delay={1200} style={[styles.heroItem, { bottom: 8, right: 20 }]} />
              <Animated.View entering={HERO_FADE}>
                <Asset3D name="hero-delivery-scooter" size={128} float />
              </Animated.View>
            </View>

            {/* Headline */}
            <Animated.View entering={ENTER.headline}>
              <Text style={styles.eyebrow}>
                {firstName ? `Welcome back, ${firstName}` : 'Local delivery, done right'}
              </Text>
              <Text style={styles.headline}>Your neighbourhood stores, delivered.</Text>
              <Text style={styles.subhead}>
                Groceries, bakeries and pharmacies near you — enter your postcode to start.
              </Text>
            </Animated.View>

            {/* Search card */}
            <Animated.View
              entering={ENTER.card}
              style={styles.card}
              onLayout={(e) => setCardBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
            >
              <Text style={styles.inputLabel}>Delivery postcode</Text>
              <Animated.View style={[styles.inputWrap, inputWrapStyle]}>
                <Feather name="map-pin" size={18} color={Colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. SW1A 1AA"
                  placeholderTextColor={Colors.muted}
                  value={postcode}
                  onChangeText={(text) => setPostcode(text.toUpperCase())}
                  onFocus={() => { inputFocus.value = withTiming(1, { duration: 160 }); }}
                  onBlur={() => { inputFocus.value = withTiming(0, { duration: 160 }); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchPress}
                />
                {postcode ? (
                  <Pressable onPress={() => setPostcode('')} hitSlop={10}>
                    <Feather name="x-circle" size={18} color={Colors.muted} />
                  </Pressable>
                ) : null}
              </Animated.View>

              <Button
                title="Search stores"
                size="full"
                onPress={handleSearchPress}
                loading={isSearching}
                disabled={busy}
                icon={<Feather name="search" size={18} color={Colors.white} />}
                style={{ marginTop: Spacing.md }}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                title="Use my current location"
                variant="outline"
                size="full"
                onPress={handleUseLocation}
                loading={isLocating}
                disabled={busy}
                icon={<Feather name="navigation" size={17} color={Colors.primary} />}
              />
            </Animated.View>

            {/* Trust row */}
            <Animated.View entering={ENTER.trust} style={styles.trustRow}>
              {[
                ['zap', 'Fast local delivery'],
                ['shield', 'Secure checkout'],
                ['star', 'Rated stores'],
              ].map(([icon, label]) => (
                <View key={label} style={styles.trustItem}>
                  <Feather name={icon} size={14} color={Colors.primary} />
                  <Text style={styles.trustText}>{label}</Text>
                </View>
              ))}
            </Animated.View>
          </Animated.ScrollView>
      </SafeAreaView>

      <NoStoresSheet
        visible={showNoStores}
        postcode={notFoundPostcode}
        onClose={() => setShowNoStores(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobViolet: {
    width: 360,
    height: 360,
    top: -120,
    left: -110,
    backgroundColor: 'rgba(163, 94, 240, 0.16)',
  },
  blobRed: {
    width: 260,
    height: 260,
    top: 40,
    right: -130,
    backgroundColor: 'rgba(239, 68, 68, 0.09)',
  },
  blobSky: {
    width: 320,
    height: 320,
    bottom: -140,
    left: 20,
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.morphic3d,
  },
  brandText: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 19,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: 4,
    paddingRight: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loginChip: { paddingHorizontal: Spacing.md, paddingVertical: 9, gap: 6 },
  loginChipText: { fontFamily: Typography.family.bold, fontSize: 13, color: Colors.primary },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: Typography.family.bold,
    fontSize: 12,
    color: Colors.white,
  },
  hero: {
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  heroHalo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: Colors.white,
  },
  heroItem: {
    position: 'absolute',
  },
  eyebrow: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  headline: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: Colors.text,
  },
  subhead: {
    fontFamily: Typography.family.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  card: {
    marginTop: Spacing.lg,
    padding: Spacing.base,
    borderRadius: Radius['2xl'],
    // Solid surface: Android renders child elevation shadows as boxes on translucent parents
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.white,
    ...Shadow.lg,
  },
  inputLabel: {
    fontFamily: Typography.family.semibold,
    fontSize: 13,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 54,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    fontFamily: Typography.family.mono,
    fontSize: 17,
    letterSpacing: 1,
    color: Colors.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Typography.family.medium,
    fontSize: 12,
    color: Colors.muted,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontFamily: Typography.family.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sheetArt: {
    marginBottom: Spacing.base,
  },
  sheetTitle: {
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: Colors.text,
  },
  sheetPostcode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
  },
  sheetPostcodeText: {
    fontFamily: Typography.family.mono,
    fontSize: 13,
    color: Colors.primary,
  },
  sheetBody: {
    fontFamily: Typography.family.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
});
