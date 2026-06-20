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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyStores } from '../api/stores.api';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius } from '../theme';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { isAuthenticated, logout } = useAuth();
  const [postcode, setPostcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
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
    try {
      const data = await getNearbyStores({ postcode: postcode.trim() });
      const stores = data.stores ?? data;
      navigation.navigate('StoreList', { stores, query: postcode.trim() });
    } catch (err) {
      Alert.alert(
        'No stores found',
        err.response?.data?.message ?? 'Could not find stores for that postcode. Please try again.'
      );
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
      const stores = data.stores ?? data;
      navigation.navigate('StoreList', { stores, query: 'your location' });
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
});
