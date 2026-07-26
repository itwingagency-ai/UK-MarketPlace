import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyStores, decodePostcode } from '../api/stores.api';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useCart } from '../context/CartContext';
import { useCustomAlert } from '../context/AlertContext';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { Feather, Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ─── Coming Soon Modal (Account Screen Style) ────────────────────────────────────────────────────────
function ComingSoonModal({ visible, postcode, onClose }) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 18,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[styles.modalCard, { transform: [{ translateY: slideAnim }] }]}>
          {/* Top Header */}
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle}>Store Status</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Feather name="x" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Icon */}
          <View style={styles.modalIconWrapper}>
            <Ionicons name="storefront-outline" size={32} color={Colors.primary} />
          </View>

          {/* Title & Postcode */}
          <Text style={styles.modalTitle}>No stores in your area yet</Text>
          {postcode ? (
            <View style={styles.modalPostcodeBadge}>
              <Text style={styles.modalPostcodeLabel}>{postcode}</Text>
            </View>
          ) : null}
          <Text style={styles.modalBody}>
            We're working hard to bring our marketplace to your neighbourhood. Be the first to know when we launch near you!
          </Text>

          {/* Account-style Action Card Box for steps */}
          <View style={styles.accountActionCard}>
            <View style={styles.accountActionRow}>
              <View style={styles.accountActionLeft}>
                <Feather name="bell" size={20} color={Colors.text} />
                <Text style={styles.accountActionText}>Get notified when we launch</Text>
              </View>
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountActionRow}>
              <View style={styles.accountActionLeft}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.text} />
                <Text style={styles.accountActionText}>New stores added every week</Text>
              </View>
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountActionRow}>
              <View style={styles.accountActionLeft}>
                <Ionicons name="map-outline" size={22} color={Colors.text} />
                <Text style={styles.accountActionText}>Try a nearby postcode</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.modalPrimaryBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalPrimaryBtnText}>Try another postcode</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.modalSecondaryBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { isAuthenticated, logout } = useAuth();
  const { location, updateLocation } = useLocation();
  const [postcode, setPostcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [notFoundPostcode, setNotFoundPostcode] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  const executeSearch = async (trimmed) => {
    setIsSearching(true);
    try {
      // Fetch stores + decode postcode to human-readable location in parallel
      const [storeResult, locationResult] = await Promise.allSettled([
        getNearbyStores({ postcode: trimmed }),
        decodePostcode(trimmed),
      ]);

      // Extract stores from response
      const apiData = storeResult.status === 'fulfilled' ? storeResult.value : null;
      const stores = apiData?.data?.stores ?? apiData?.stores ?? [];

      if (stores.length === 0) {
        setNotFoundPostcode(trimmed);
        setShowComingSoon(true);
        setIsSearching(false);
        return;
      }

      // Build human-readable location label from postcodes.io
      let locationLabel = trimmed;
      if (locationResult.status === 'fulfilled' && locationResult.value) {
        const loc = locationResult.value;
        const parts = [loc.admin_ward, loc.admin_district].filter(Boolean);
        if (parts.length > 0) locationLabel = parts.join(', ');
      } else if (apiData?.data?.resolvedLocation?.formattedAddress) {
        locationLabel = apiData.data.resolvedLocation.formattedAddress;
      }

      if (apiData?.data?.resolvedLocation?.lat) {
        checkCartAndProceed(
          stores, 
          trimmed, 
          locationLabel, 
          apiData.data.resolvedLocation.lat, 
          apiData.data.resolvedLocation.lng
        );
      } else {
        checkCartAndProceed(stores, trimmed, locationLabel, null, null);
      }
    } catch (err) {
      setNotFoundPostcode(trimmed);
      setShowComingSoon(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchPress = async () => {
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
    
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    const trimmed = postcode.trim().toUpperCase();
    executeSearch(trimmed);
  };

  const executeLocationSearch = async () => {
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
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const data = await getNearbyStores({ lat: latitude, lng: longitude });
      const stores = data?.data?.stores ?? data?.stores ?? [];

      if (stores.length === 0) {
        setNotFoundPostcode('your location');
        setShowComingSoon(true);
        setIsLocating(false);
        return;
      }

      checkCartAndProceed(stores, 'My Location', 'Your Location', latitude, longitude);
    } catch (err) {
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

  const handleUseLocation = async () => {
    executeLocationSearch();
  };

  const handleLogout = async () => {
    showAlert({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      icon: 'log-out',
      isDestructive: true,
      confirmText: 'Log out',
      onConfirm: () => logout()
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-bleed background image (blue blob + all food items) */}
      <Image
        source={require('../../assets/home_hero_bg.png')}
        style={styles.bgImage}
        resizeMode="cover"
      />

      {/* Overlay so the bottom white section is clear */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      </SafeAreaView>

      {/* Scrollable content for keyboard avoidance */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Spacer to push card down to CARD_TOP */}
          <View style={{ height: CARD_TOP }} />

          <View style={styles.card}>
          {/* Brand */}
          <View style={styles.brandBlock}>
            <Text style={styles.brandLine1}>snappy</Text>
            <View style={styles.brandRow}>
              <Text style={styles.brandLine2}>shopper</Text>
              <Text style={styles.truckEmoji}> 🚐</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>Find your nearest store</Text>

          {/* Postcode input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.pinIcon}>📍</Text>
            <TextInput
              style={styles.postcodeInput}
              placeholder="Enter your postcode"
              placeholderTextColor={Colors.muted}
              value={postcode}
              onChangeText={setPostcode}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearchPress}
            />
          </View>

          {/* Search button */}
          <Animated.View style={[styles.btnContainer, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearchPress}
              disabled={isSearching || isLocating}
              activeOpacity={0.85}
            >
              {isSearching ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <Text style={styles.searchBtnText}>Search stores</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Use my location link */}
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={handleUseLocation}
            disabled={isSearching || isLocating}
            activeOpacity={0.7}
          >
            {isLocating ? (
              <ActivityIndicator color={Colors.white} size="small" style={{ marginRight: 8 }} />
            ) : (
              <Text style={styles.locationIconText}>✈️</Text>
            )}
            <Text style={styles.locationText}> Use my current location</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Coming Soon Modal */}
      <ComingSoonModal
        visible={showComingSoon}
        postcode={notFoundPostcode}
        onClose={() => setShowComingSoon(false)}
      />
    </View>
  );
}

const CARD_TOP = height * 0.44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFF1F5',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height: CARD_TOP + 40,
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 44 : 0,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(220,230,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLine1: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  brandLine2: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  truckEmoji: {
    fontSize: 30,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    borderWidth: 0,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    width: '100%',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  pinIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  postcodeInput: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.text,
    fontWeight: Typography.weight.medium,
  },
  btnContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 17,
    width: '100%',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  searchBtnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  locationIconText: {
    fontSize: 15,
  },
  locationText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.white,
  },

  // ── Coming Soon Modal (Account Screen Style) ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
    paddingTop: 0,
    alignItems: 'center',
  },
  modalHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: Spacing.lg,
  },
  modalHeaderTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  modalPostcodeBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  modalPostcodeLabel: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalBody: {
    fontSize: Typography.size.sm,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 300,
  },
  accountActionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  accountActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  accountActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountActionText: {
    marginLeft: Spacing.md,
    fontSize: Typography.size.sm,
    color: '#374151',
    fontWeight: '500',
  },
  accountDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 36,
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  modalPrimaryBtnText: {
    fontSize: Typography.size.md,
    fontWeight: '700',
    color: Colors.white,
  },
  modalSecondaryBtn: {
    paddingVertical: Spacing.sm,
  },
  modalSecondaryBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: '600',
    color: '#6B7280',
  },
});
