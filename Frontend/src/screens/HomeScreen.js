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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyStores, decodePostcode } from '../api/stores.api';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius } from '../theme';

const { width, height } = Dimensions.get('window');

// ─── Coming Soon Modal ────────────────────────────────────────────────────────
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
        <Animated.View
          style={[styles.modalCard, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Top accent bar */}
          <View style={styles.modalAccentBar} />

          {/* Icon */}
          <View style={styles.modalIconWrapper}>
            <Text style={styles.modalIconEmoji}>🏪</Text>
          </View>

          {/* Text */}
          <Text style={styles.modalTitle}>No stores in your area yet</Text>
          {postcode ? (
            <Text style={styles.modalPostcodeLabel}>{postcode}</Text>
          ) : null}
          <Text style={styles.modalBody}>
            We're working hard to bring Snappy Shopper to your neighbourhood. Be the first to
            know when we launch near you!
          </Text>

          {/* Coming soon badge */}
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonDot}>●</Text>
            <Text style={styles.comingSoonText}>Coming Soon to This Area</Text>
          </View>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {[
              { icon: '📧', label: 'Get notified when we launch' },
              { icon: '🚀', label: 'New stores added every week' },
              { icon: '🗺️', label: 'Try a nearby postcode' },
            ].map((item, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIconWrapper}>
                  <Text style={styles.stepIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.stepLabel}>{item.label}</Text>
              </View>
            ))}
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
  const [postcode, setPostcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [notFoundPostcode, setNotFoundPostcode] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleSearchPress = async () => {
    if (!postcode.trim()) {
      Alert.alert('Postcode required', 'Please enter a postcode to search stores near you.');
      return;
    }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setIsSearching(true);
    const trimmed = postcode.trim().toUpperCase();

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
        // No stores — show professional "coming soon" modal
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

      navigation.navigate('ShopHome', {
        stores,
        postcode: trimmed,
        locationLabel,
      });
    } catch (err) {
      // API or network error — show coming soon modal
      setNotFoundPostcode(trimmed);
      setShowComingSoon(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Enable location access in settings to use this feature.');
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

      navigation.navigate('ShopHome', {
        stores,
        postcode: 'My Location',
        locationLabel: 'Your Location',
      });
    } catch (err) {
      Alert.alert('Location error', 'Unable to get your location. Please try entering a postcode.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
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
        {/* Log out button — top right */}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutText}>Log out  →</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Bottom card */}
      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              <ActivityIndicator color={Colors.primary} size="small" style={{ marginRight: 8 }} />
            ) : (
              <Text style={styles.locationIconText}>✈️</Text>
            )}
            <Text style={styles.locationText}> Use my current location</Text>
          </TouchableOpacity>
        </View>
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
  cardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: CARD_TOP,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
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
    color: Colors.text,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  brandLine2: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  truckEmoji: {
    fontSize: 30,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    width: '100%',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    color: Colors.primary,
  },

  // ── Coming Soon Modal ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['5xl'],
    paddingTop: 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  modalAccentBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: 12,
    marginBottom: Spacing.lg,
  },
  modalIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  modalIconEmoji: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: Spacing.sm,
  },
  modalPostcodeLabel: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  modalBody: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 300,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: Spacing['2xl'],
    gap: 6,
  },
  comingSoonDot: {
    fontSize: 8,
    color: '#F59E0B',
  },
  comingSoonText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: '#92400E',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepsContainer: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  stepIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepIcon: {
    fontSize: 18,
  },
  stepLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
    flex: 1,
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  modalPrimaryBtnText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  modalSecondaryBtn: {
    paddingVertical: Spacing.sm,
  },
  modalSecondaryBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.muted,
  },
});
