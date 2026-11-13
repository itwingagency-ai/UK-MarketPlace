import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Colors, Spacing, Typography, Radius, Shadow, Motion } from '../theme';
import { formatPence } from '../components/ProductCard';

// Entrance animations are built once: a new builder per render remounts views.
const SECTION_IN = Array.from({ length: 4 }, (_, i) =>
  FadeInDown.delay(60 + i * Motion.stagger.cards).springify().damping(Motion.springs.gentle.damping)
);
import { previewCheckout, placeOrder, cancelTransaction, confirmTransaction } from '../api/checkout.api';
import { getMyAddresses, addMyAddress } from '../api/profile.api';
import { useCart } from '../context/CartContext';
import { useCustomAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';

const calculateHaversineKm = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((6371 * c).toFixed(2));
};

// UK Postcode Coordinate Lookup via postcodes.io
const lookupUKPostcode = async (postcode) => {
  if (!postcode || postcode.trim().length < 5) return null;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
    const data = await res.json();
    if (data && data.status === 200 && data.result) {
      return {
        lat: data.result.latitude,
        lng: data.result.longitude,
      };
    }
  } catch (e) {
    console.log('Postcode lookup failed:', e);
  }
  return null;
};

// UK Address Suggestion Helper using Nominatim & Photon Komoot (Filtered for GB/UK)
const fetchUKAddressSuggestions = async (query) => {
  if (!query || query.trim().length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query.trim()
    )}&countrycodes=gb&format=json&addressdetails=1&limit=6`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'UKMarketPlaceApp/1.0 (Contact: support@ukmarketplace.co.uk)',
      },
    });
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item) => {
        const addr = item.address || {};
        const houseNo = addr.house_number || addr.building || '';
        const road = addr.road || addr.pedestrian || addr.street || item.name || '';
        const line1 = houseNo ? `${houseNo} ${road}`.trim() : road;
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
        const postalCode = addr.postcode || '';
        const state = addr.state || addr.county || '';
        return {
          id: String(item.place_id || Math.random()),
          displayName: item.display_name,
          line1: line1 || item.display_name.split(',')[0] || '',
          city: city || 'London',
          postalCode,
          state,
          lat: item.lat != null ? Number(item.lat) : null,
          lng: item.lon != null ? Number(item.lon) : null,
        };
      });
    }
  } catch (err) {
    console.log('Nominatim failed, trying fallback...', err);
  }

  // Fallback to Photon Komoot API
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query.trim()
    )}&filter=countrycode:gb&limit=6`;
    const res = await fetch(photonUrl);
    const photonData = await res.json();
    if (photonData && photonData.features) {
      return photonData.features.map((f, idx) => {
        const props = f.properties || {};
        const houseNo = props.housenumber || '';
        const street = props.street || props.name || '';
        const line1 = houseNo ? `${houseNo} ${street}`.trim() : street;
        const city = props.city || props.town || props.village || props.county || '';
        const postalCode = props.postcode || '';
        const state = props.state || props.county || '';
        const displayName = [line1, city, postalCode, 'UK'].filter(Boolean).join(', ');
        const coords = props.geometry?.coordinates || f.geometry?.coordinates || [];
        const lng = coords[0] != null ? Number(coords[0]) : null;
        const lat = coords[1] != null ? Number(coords[1]) : null;
        return {
          id: String(props.osm_id || idx),
          displayName: displayName || props.name,
          line1: line1 || props.name || '',
          city: city || 'London',
          postalCode,
          state,
          lat,
          lng,
        };
      });
    }
  } catch (photonErr) {
    console.log('Photon fallback also failed:', photonErr);
  }
  return [];
};

export default function CheckoutScreen({ navigation }) {
  const { clearCart, fetchCart, items } = useCart();
  const { showAlert } = useCustomAlert();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { user } = useAuth();

  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const storeName = items && items[0]?.product?.store?.name ? items[0].product.store.name : 'Your store';
  const insets = useSafeAreaInsets();

  // Android is edge-to-edge, so the window doesn't shrink for the keyboard.
  // An animated spacer (UI thread, no re-render) lets the form scroll above it.
  const keyboard = useAnimatedKeyboard();
  const keyboardSpacer = useAnimatedStyle(() => ({ height: keyboard.height.value }));

  // Form State
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'online' or 'cod'
  const [address, setAddress] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    state: '',
    lat: null,
    lng: null,
  });

  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);

  useEffect(() => {
    const loadSavedAddresses = async () => {
      try {
        const res = await getMyAddresses();
        const list = res?.data || [];
        setSavedAddresses(list);
        const defaultAddr = list.find((a) => a.isDefault) || list[0];
        if (defaultAddr) {
          handleSelectSavedAddress(defaultAddr);
        }
      } catch (err) {
        console.log('Failed to fetch saved addresses in checkout:', err);
      }
    };
    loadSavedAddresses();
  }, []);

  const handleSelectSavedAddress = (item) => {
    setSelectedSavedAddressId(item._id);
    setAddress({
      fullName: item.fullName || user?.name || '',
      phone: item.phone || user?.phone || '',
      line1: item.line1 || '',
      line2: item.line2 || '',
      city: item.city || '',
      postalCode: item.postalCode || '',
      state: item.state || '',
      lat: item.lat != null ? Number(item.lat) : null,
      lng: item.lng != null ? Number(item.lng) : null,
    });
    setAddressQuery(item.line1 || '');
    setShowSuggestions(false);
  };

  // Delivery Range Verification State
  const [deliveryRangeStatus, setDeliveryRangeStatus] = useState({
    checked: false,
    inRange: true,
    distanceKm: null,
    maxRadiusKm: null,
    storeName: '',
    message: '',
  });

  useEffect(() => {
    if (!addressQuery || addressQuery.trim().length < 3) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      const results = await fetchUKAddressSuggestions(addressQuery);
      setSuggestions(results);
      setIsLoadingSuggestions(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [addressQuery]);

  // Auto-lookup coordinates from UK Postcode when entered manually or updated
  useEffect(() => {
    if (!address.postalCode || address.postalCode.trim().length < 5) return;
    const timer = setTimeout(async () => {
      const coords = await lookupUKPostcode(address.postalCode);
      if (coords && coords.lat != null && coords.lng != null) {
        setAddress((prev) => {
          if (prev.lat === coords.lat && prev.lng === coords.lng) return prev;
          return { ...prev, lat: coords.lat, lng: coords.lng };
        });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [address.postalCode]);

  // Real-time Store Delivery Range Evaluation
  useEffect(() => {
    if (address.lat == null || address.lng == null || !previewData?.byStore) {
      setDeliveryRangeStatus((prev) => ({ ...prev, checked: false }));
      return;
    }

    const stores = previewData.byStore;
    let allInRange = true;
    let worstDistance = 0;
    let limitRadius = 0;
    let targetStoreName = '';
    let outOfRangeMsg = '';

    for (const store of stores) {
      if (!store.locationSet || !store.location?.coordinates) {
        continue;
      }
      const [storeLng, storeLat] = store.location.coordinates;
      const dist = calculateHaversineKm(address.lat, address.lng, storeLat, storeLng);
      const maxRad = store.deliveryRadiusKm || 10;

      if (dist > maxRad) {
        allInRange = false;
        worstDistance = dist;
        limitRadius = maxRad;
        targetStoreName = store.storeName;
        outOfRangeMsg = `❌ Outside Delivery Range: ${store.storeName} only delivers within ${maxRad} km (your address is ${dist} km away).`;
        break;
      } else {
        worstDistance = Math.max(worstDistance, dist);
        limitRadius = maxRad;
        targetStoreName = store.storeName;
      }
    }

    if (stores.length > 0) {
      setDeliveryRangeStatus({
        checked: true,
        inRange: allInRange,
        distanceKm: worstDistance,
        maxRadiusKm: limitRadius,
        storeName: targetStoreName || storeName,
        message: allInRange
          ? `✓ Within Delivery Range of ${targetStoreName || 'store'} (${worstDistance} km away, max radius ${limitRadius} km)`
          : outOfRangeMsg,
      });
    }
  }, [address.lat, address.lng, previewData]);

  const handleLine1Change = (text) => {
    setAddress((prev) => ({ ...prev, line1: text }));
    setSelectedSavedAddressId(null);
    setAddressQuery(text);
    if (text.trim().length >= 3) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item) => {
    setSelectedSavedAddressId(null);
    setAddress((prev) => ({
      ...prev,
      line1: item.line1 || item.displayName.split(',')[0] || prev.line1,
      city: item.city || prev.city,
      postalCode: item.postalCode || prev.postalCode,
      state: item.state || prev.state,
      lat: item.lat != null ? item.lat : prev.lat,
      lng: item.lng != null ? item.lng : prev.lng,
    }));
    setAddressQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
  };

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
    if (!address.fullName?.trim() || !address.phone?.trim() || !address.line1?.trim() || !address.city?.trim() || !address.postalCode?.trim()) {
      showAlert({
        title: 'Missing Details',
        message: 'Please fill in all mandatory address fields, including your Phone Number and UK Postcode.',
        icon: 'alert-circle',
      });
      return;
    }

    if (deliveryRangeStatus.checked && !deliveryRangeStatus.inRange) {
      showAlert({
        title: 'Outside Delivery Range',
        message: deliveryRangeStatus.message || 'Your selected address is outside the store delivery radius.',
        icon: 'alert-circle',
      });
      return;
    }

    setIsPlacingOrder(true);

    try {
      // 1. Call Backend to create order and get Stripe clientSecret
      let finalAddressId = selectedSavedAddressId;
      if (!finalAddressId) {
        try {
          const savedRes = await addMyAddress({
            label: 'Shipping',
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2 || '',
            city: address.city,
            postalCode: address.postalCode,
            lat: address.lat != null ? Number(address.lat) : null,
            lng: address.lng != null ? Number(address.lng) : null,
            isDefault: savedAddresses.length === 0,
          });
          if (savedRes && savedRes.data) {
            finalAddressId = savedRes.data._id;
            setSavedAddresses((prev) => [...prev, savedRes.data]);
          }
        } catch (saveErr) {
          console.log('Could not auto-save address to profile:', saveErr);
        }
      }

      const payload = finalAddressId
        ? {
            addressId: finalAddressId,
            paymentMethod,
            clientType: 'mobile',
          }
        : {
            shippingAddress: {
              ...address,
              country: 'UK',
            },
            lat: address.lat != null ? Number(address.lat) : undefined,
            lng: address.lng != null ? Number(address.lng) : undefined,
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
        <Text style={styles.loadingText}>Preparing your checkout…</Text>
      </SafeAreaView>
    );
  }

  const orders = previewData?.byStore ?? [];
  const grandTotal = previewData?.grandTotal ?? 0;
  const canPlace = !isPlacingOrder && previewData?.canCheckout;

  const field = (props) => (
    <TextInput placeholderTextColor={Colors.muted} {...props} style={[styles.input, props.style]} />
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.circleBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSubtitle}>
            {orders.length > 1 ? `${orders.length} stores · ${orders.length} orders` : orders[0]?.storeName || storeName}
          </Text>
        </View>
        <View style={styles.secureBadge}>
          <Feather name="lock" size={12} color={Colors.successText} />
          <Text style={styles.secureText}>Secure</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Delivery address */}
        <Animated.View entering={SECTION_IN[0]} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.stepDot}><Text style={styles.stepDotText}>1</Text></View>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            <View style={styles.ukBadge}><Text style={styles.ukBadgeText}>UK only</Text></View>
          </View>

          <View style={styles.card}>
            {savedAddresses.length > 0 && (
              <View style={styles.savedAddressContainer}>
                <Text style={styles.fieldLabel}>Saved addresses</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedAddressScroll}>
                  {savedAddresses.map((item) => {
                    const isSelected = selectedSavedAddressId === item._id;
                    return (
                      <Pressable
                        key={item._id}
                        style={[styles.savedAddressCard, isSelected && styles.savedAddressCardSelected]}
                        onPress={() => handleSelectSavedAddress(item)}
                      >
                        <View style={styles.savedAddressRowHeader}>
                          <Feather name={isSelected ? 'check-circle' : 'home'} size={14} color={isSelected ? Colors.primary : Colors.textSecondary} />
                          <Text style={[styles.savedAddressLabel, isSelected && styles.savedAddressLabelSelected]}>
                            {item.label || 'Home'}
                          </Text>
                          {item.isDefault && (
                            <View style={styles.savedDefaultBadge}><Text style={styles.savedDefaultText}>Default</Text></View>
                          )}
                        </View>
                        <Text style={styles.savedAddressText} numberOfLines={1}>{item.line1}</Text>
                        <Text style={styles.savedAddressSub} numberOfLines={1}>{item.city}, {item.postalCode}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or enter a new address</Text>
                  <View style={styles.orLine} />
                </View>
              </View>
            )}

            {field({
              placeholder: 'Full name',
              value: address.fullName,
              onChangeText: (text) => { setAddress({ ...address, fullName: text }); setSelectedSavedAddressId(null); },
            })}
            {field({
              placeholder: 'Phone number *',
              keyboardType: 'phone-pad',
              value: address.phone,
              onChangeText: (text) => { setAddress({ ...address, phone: text }); setSelectedSavedAddressId(null); },
            })}

            <View style={styles.addressInputContainer}>
              {field({
                placeholder: 'Start typing your street address',
                value: address.line1,
                onChangeText: handleLine1Change,
                style: { marginBottom: 0, paddingRight: 44 },
              })}
              <View style={styles.inputIconRight}>
                {isLoadingSuggestions ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Feather name="map-pin" size={18} color={Colors.primary} />
                )}
              </View>
            </View>

            {showSuggestions && (
              <View style={styles.suggestionsBox}>
                <View style={styles.suggestionsHeaderRow}>
                  <Text style={styles.suggestionsHeader}>Suggested UK addresses</Text>
                  <Pressable onPress={() => setShowSuggestions(false)} hitSlop={8}>
                    <Feather name="x" size={16} color={Colors.muted} />
                  </Pressable>
                </View>
                {isLoadingSuggestions ? (
                  <View style={styles.suggestionsLoadingRow}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.suggestionsLoadingText}>Searching addresses…</Text>
                  </View>
                ) : suggestions.length > 0 ? (
                  suggestions.map((item, index) => (
                    <Pressable
                      key={item.id || index}
                      style={[styles.suggestionItem, index === suggestions.length - 1 && styles.suggestionItemLast]}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <View style={styles.suggestionIcon}><Feather name="map-pin" size={14} color={Colors.primary} /></View>
                      <View style={styles.suggestionTextContainer}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.line1 || item.displayName.split(',')[0]}
                        </Text>
                        <Text style={styles.suggestionSubtitle} numberOfLines={2}>{item.displayName}</Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.noSuggestionsText}>No matches — you can enter the address manually.</Text>
                )}
              </View>
            )}

            {field({
              placeholder: 'Flat, suite, etc. (optional)',
              value: address.line2,
              onChangeText: (text) => { setAddress({ ...address, line2: text }); setSelectedSavedAddressId(null); },
              style: { marginTop: Spacing.md },
            })}

            <View style={styles.rowInputs}>
              {field({
                placeholder: 'Town / city',
                value: address.city,
                onChangeText: (text) => setAddress({ ...address, city: text }),
                style: styles.halfInput,
              })}
              {field({
                placeholder: 'Postcode',
                autoCapitalize: 'characters',
                value: address.postalCode,
                onChangeText: (text) => setAddress({ ...address, postalCode: text }),
                style: styles.halfInput,
              })}
            </View>

            {deliveryRangeStatus.checked && (
              <View style={[styles.rangeBanner, deliveryRangeStatus.inRange ? styles.rangeBannerSuccess : styles.rangeBannerError]}>
                <Feather
                  name={deliveryRangeStatus.inRange ? 'check-circle' : 'alert-circle'}
                  size={18}
                  color={deliveryRangeStatus.inRange ? Colors.successText : Colors.errorText}
                />
                <Text style={[styles.rangeBannerText, deliveryRangeStatus.inRange ? styles.rangeTextSuccess : styles.rangeTextError]}>
                  {deliveryRangeStatus.message.replace(/^[✅❌]\s*/u, '')}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Payment */}
        <Animated.View entering={SECTION_IN[1]} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.stepDot}><Text style={styles.stepDotText}>2</Text></View>
            <Text style={styles.sectionTitle}>Payment</Text>
          </View>
          {[
            ['online', 'Card', 'Pay securely with Stripe', 'credit-card'],
            ['cod', 'Cash on delivery', 'Pay the rider when it arrives', 'dollar-sign'],
          ].map(([key, label, hint, icon]) => {
            const active = paymentMethod === key;
            return (
              <Pressable
                key={key}
                onPress={() => setPaymentMethod(key)}
                style={[styles.paymentOption, active && styles.paymentOptionActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <View style={[styles.paymentIcon, active && styles.paymentIconActive]}>
                  <Feather name={icon} size={18} color={active ? Colors.white : Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentOptionText}>{label}</Text>
                  <Text style={styles.paymentHint}>{hint}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Summary */}
        {previewData && (
          <Animated.View entering={SECTION_IN[2]} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepDot}><Text style={styles.stepDotText}>3</Text></View>
              <Text style={styles.sectionTitle}>Review</Text>
            </View>

            {orders.length > 0 ? (
              orders.map((storeOrder, idx) => (
                <View key={storeOrder.storeId || idx} style={[styles.card, { marginBottom: Spacing.md }]}>
                  <View style={styles.orderHeader}>
                    <View style={styles.storeIcon}><Feather name="shopping-bag" size={14} color={Colors.primary} /></View>
                    <Text style={styles.orderStore} numberOfLines={1}>{storeOrder.storeName || `Store ${idx + 1}`}</Text>
                    {orders.length > 1 ? (
                      <View style={styles.orderTag}><Text style={styles.orderTagText}>Order {idx + 1}</Text></View>
                    ) : null}
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Items ({storeOrder.itemCount})</Text>
                    <Text style={styles.summaryValue}>{formatPence(storeOrder.subtotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery</Text>
                    <Text style={styles.summaryValue}>{storeOrder.shippingFee > 0 ? formatPence(storeOrder.shippingFee) : 'Free'}</Text>
                  </View>
                  {orders.length > 1 ? (
                    <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                      <Text style={styles.summaryStoreTotalLabel}>Order total</Text>
                      <Text style={styles.summaryStoreTotalValue}>{formatPence(storeOrder.total)}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.card}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>{formatPence(previewData.subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery</Text>
                  <Text style={styles.summaryValue}>{formatPence(previewData.shippingFee)}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        <Animated.View style={keyboardSpacer} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>{orders.length > 1 ? 'Grand total' : 'Total'}</Text>
          <Text style={styles.footerTotal}>{formatPence(grandTotal)}</Text>
        </View>
        <Pressable
          style={[styles.placeOrderBtn, !canPlace && styles.placeOrderBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={!canPlace}
        >
          {isPlacingOrder ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.placeOrderBtnText}>{paymentMethod === 'online' ? 'Pay now' : 'Place order'}</Text>
              <Feather name="arrow-right" size={18} color={Colors.white} />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg, gap: Spacing.md },
  loadingText: { fontFamily: Typography.family.medium, fontSize: 14, color: Colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: { fontFamily: Typography.family.displayExtrabold, fontSize: 24, letterSpacing: -0.6, color: Colors.text },
  headerSubtitle: { fontFamily: Typography.family.medium, fontSize: 13, color: Colors.textSecondary },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
  },
  secureText: { fontFamily: Typography.family.bold, fontSize: 11, color: Colors.successText },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: 140 },
  section: { marginTop: Spacing.base },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  stepDotText: { fontFamily: Typography.family.bold, fontSize: 12, color: Colors.white },
  sectionTitle: { flex: 1, fontFamily: Typography.family.display, fontSize: 18, letterSpacing: -0.3, color: Colors.text },
  ukBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.primarySubtle },
  ukBadgeText: { fontFamily: Typography.family.bold, fontSize: 11, color: Colors.primary },
  card: {
    padding: Spacing.base,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.sm,
  },
  fieldLabel: { fontFamily: Typography.family.semibold, fontSize: 13, color: Colors.text, marginBottom: Spacing.sm },
  savedAddressContainer: { marginBottom: Spacing.sm },
  savedAddressScroll: { gap: Spacing.sm },
  savedAddressCard: {
    width: 190,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  savedAddressCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  savedAddressRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  savedAddressLabel: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text },
  savedAddressLabelSelected: { color: Colors.primary },
  savedDefaultBadge: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary },
  savedDefaultText: { fontFamily: Typography.family.semibold, fontSize: 10, color: Colors.textSecondary },
  savedAddressText: { fontFamily: Typography.family.medium, fontSize: 13, color: Colors.text },
  savedAddressSub: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontFamily: Typography.family.medium, fontSize: 12, color: Colors.muted },
  input: {
    height: 50,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontFamily: Typography.family.regular,
    fontSize: 15,
    color: Colors.text,
  },
  addressInputContainer: { position: 'relative' },
  inputIconRight: { position: 'absolute', right: Spacing.base, top: 0, bottom: 0, justifyContent: 'center' },
  suggestionsBox: {
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
  },
  suggestionsHeader: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.textSecondary },
  suggestionsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  suggestionsLoadingText: { fontFamily: Typography.family.regular, fontSize: 13, color: Colors.textSecondary },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  suggestionItemLast: { borderBottomWidth: 0 },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  suggestionTextContainer: { flex: 1 },
  suggestionTitle: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  suggestionSubtitle: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary },
  noSuggestionsText: { fontFamily: Typography.family.regular, fontSize: 13, color: Colors.textSecondary, padding: Spacing.md },
  rowInputs: { flexDirection: 'row', gap: Spacing.md },
  halfInput: { flex: 1 },
  rangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  rangeBannerSuccess: { backgroundColor: Colors.successBg },
  rangeBannerError: { backgroundColor: Colors.errorBg },
  rangeBannerText: { flex: 1, fontFamily: Typography.family.medium, fontSize: 13, lineHeight: 18 },
  rangeTextSuccess: { color: Colors.successText },
  rangeTextError: { color: Colors.errorText },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  paymentOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  paymentIconActive: { backgroundColor: Colors.primary },
  paymentOptionText: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  paymentHint: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  storeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  orderStore: { flex: 1, fontFamily: Typography.family.display, fontSize: 15, color: Colors.text },
  orderTag: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.primarySubtle },
  orderTagText: { fontFamily: Typography.family.bold, fontSize: 11, color: Colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle, marginTop: Spacing.sm, paddingTop: Spacing.sm },
  summaryStoreTotalLabel: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.text },
  summaryStoreTotalValue: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.primary },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    ...Shadow.xl,
  },
  footerLabel: { fontFamily: Typography.family.regular, fontSize: 12, color: Colors.textSecondary },
  footerTotal: { fontFamily: Typography.family.displayExtrabold, fontSize: 22, color: Colors.text },
  placeOrderBtn: {
    flex: 1.3,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    ...Shadow.morphic3d,
  },
  placeOrderBtnDisabled: { backgroundColor: Colors.muted },
  placeOrderBtnText: { fontFamily: Typography.family.bold, fontSize: 16, color: Colors.white },
});
