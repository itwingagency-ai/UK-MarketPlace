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
import { getMyAddresses, addMyAddress } from '../api/profile.api';
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

// UK Distance Helper (Haversine Formula in km)
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

  const storeName = items && items[0]?.product?.store?.name ? items[0].product.store.name : 'Snappy Store';

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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Shipping Address</Text>
              <View style={styles.ukBadge}>
                <Text style={styles.ukBadgeText}>🇬🇧 UK Only</Text>
              </View>
            </View>
            <View style={styles.card}>
              {savedAddresses.length > 0 && (
                <View style={styles.savedAddressContainer}>
                  <Text style={styles.savedAddressHeader}>Select from Saved Addresses</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.savedAddressScroll}
                  >
                    {savedAddresses.map((item) => {
                      const isSelected = selectedSavedAddressId === item._id;
                      return (
                        <TouchableOpacity
                          key={item._id}
                          style={[styles.savedAddressCard, isSelected && styles.savedAddressCardSelected]}
                          onPress={() => handleSelectSavedAddress(item)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.savedAddressRowHeader}>
                            <Text style={[styles.savedAddressLabel, isSelected && styles.savedAddressLabelSelected]}>
                              {item.label || 'Home'}
                            </Text>
                            {item.isDefault && (
                              <View style={styles.savedDefaultBadge}>
                                <Text style={styles.savedDefaultText}>Default</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.savedAddressText} numberOfLines={1}>
                            {item.line1}
                          </Text>
                          <Text style={styles.savedAddressSub} numberOfLines={1}>
                            {item.city}, {item.postalCode}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.divider} />
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.muted}
                value={address.fullName}
                onChangeText={(text) => {
                  setAddress({ ...address, fullName: text });
                  setSelectedSavedAddressId(null);
                }}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number *"
                placeholderTextColor={Colors.muted}
                keyboardType="phone-pad"
                value={address.phone}
                onChangeText={(text) => {
                  setAddress({ ...address, phone: text });
                  setSelectedSavedAddressId(null);
                }}
              />
              
              <View style={styles.addressInputContainer}>
                <TextInput
                  style={[styles.input, { marginBottom: 0, paddingRight: 40 }]}
                  placeholder="Street Address (Start typing for UK suggestions...)"
                  placeholderTextColor={Colors.muted}
                  value={address.line1}
                  onChangeText={handleLine1Change}
                />
                <View style={styles.inputIconRight}>
                  {isLoadingSuggestions ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="location-outline" size={20} color={Colors.primary} />
                  )}
                </View>
              </View>

              {showSuggestions && (
                <View style={styles.suggestionsBox}>
                  <View style={styles.suggestionsHeaderRow}>
                    <Text style={styles.suggestionsHeader}>🇬🇧 UK Address Suggestions</Text>
                    <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                      <Feather name="x" size={16} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                  {isLoadingSuggestions ? (
                    <View style={styles.suggestionsLoadingRow}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.suggestionsLoadingText}>Searching UK addresses...</Text>
                    </View>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((item, index) => (
                      <TouchableOpacity
                        key={item.id || index}
                        style={[
                          styles.suggestionItem,
                          index === suggestions.length - 1 && styles.suggestionItemLast
                        ]}
                        onPress={() => handleSelectSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="location-sharp" size={18} color={Colors.primary} style={styles.suggestionIcon} />
                        <View style={styles.suggestionTextContainer}>
                          <Text style={styles.suggestionTitle} numberOfLines={1}>
                            {item.line1 || item.displayName.split(',')[0]}
                          </Text>
                          <Text style={styles.suggestionSubtitle} numberOfLines={2}>
                            {item.displayName}
                          </Text>
                        </View>
                        <Feather name="arrow-down-left" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.noSuggestionsRow}>
                      <Text style={styles.noSuggestionsText}>No matching UK addresses found. You can enter manually below.</Text>
                    </View>
                  )}
                </View>
              )}

              <TextInput
                style={[styles.input, { marginTop: Spacing.sm }]}
                placeholder="Apartment, suite, etc. (Optional)"
                placeholderTextColor={Colors.muted}
                value={address.line2}
                onChangeText={(text) => {
                  setAddress({ ...address, line2: text });
                  setSelectedSavedAddressId(null);
                }}
              />

              <View style={[styles.rowInputs, { marginTop: Spacing.md }]}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="City / Town"
                  placeholderTextColor={Colors.muted}
                  value={address.city}
                  onChangeText={(text) => setAddress({ ...address, city: text })}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Postcode (e.g. SW1)"
                  placeholderTextColor={Colors.muted}
                  autoCapitalize="characters"
                  value={address.postalCode}
                  onChangeText={(text) => setAddress({ ...address, postalCode: text })}
                />
              </View>

              {/* Delivery Range Verification Banner */}
              {deliveryRangeStatus.checked && (
                <View
                  style={[
                    styles.rangeBanner,
                    deliveryRangeStatus.inRange ? styles.rangeBannerSuccess : styles.rangeBannerError,
                  ]}
                >
                  <Ionicons
                    name={deliveryRangeStatus.inRange ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={deliveryRangeStatus.inRange ? '#15803D' : '#DC2626'}
                  />
                  <Text
                    style={[
                      styles.rangeBannerText,
                      deliveryRangeStatus.inRange ? styles.rangeTextSuccess : styles.rangeTextError,
                    ]}
                  >
                    {deliveryRangeStatus.message}
                  </Text>
                </View>
              )}
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
              <Text style={styles.sectionTitle}>
                Order Summary ({previewData.byStore?.length || 1} {previewData.byStore?.length === 1 ? 'Order' : 'Orders'})
              </Text>
              
              {previewData.byStore && previewData.byStore.length > 0 ? (
                previewData.byStore.map((storeOrder, idx) => (
                  <View key={storeOrder.storeId || idx} style={[styles.card, { marginBottom: Spacing.md }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: Spacing.xs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="storefront-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                        <Text style={{ fontWeight: '700', fontSize: Typography.size.base, color: Colors.text }}>{storeOrder.storeName || `Store #${idx + 1}`}</Text>
                      </View>
                      <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>Order #{idx + 1}</Text>
                      </View>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal ({storeOrder.itemCount} items)</Text>
                      <Text style={styles.summaryValue}>£{(storeOrder.subtotal / 100).toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Shipping</Text>
                      <Text style={styles.summaryValue}>£{(storeOrder.shippingFee / 100).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: Spacing.xs, marginTop: 4 }]}>
                      <Text style={{ fontWeight: '700', color: Colors.text }}>Store Order Total</Text>
                      <Text style={{ fontWeight: '800', color: Colors.primary }}>£{(storeOrder.total / 100).toFixed(2)}</Text>
                    </View>
                  </View>
                ))
              ) : (
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
              )}

              {previewData.byStore?.length > 1 && (
                <View style={[styles.card, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: Colors.primary, marginTop: Spacing.xs }]}>
                  <View style={[styles.summaryRow, styles.summaryTotalRow, { borderTopWidth: 0, marginTop: 0, paddingTop: 0 }]}>
                    <Text style={styles.summaryTotalLabel}>Grand Total (All Orders)</Text>
                    <Text style={styles.summaryTotalValue}>£{(previewData.grandTotal / 100).toFixed(2)}</Text>
                  </View>
                </View>
              )}
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
    height: 50,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    fontSize: Typography.size.base,
    color: Colors.text,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  ukBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ukBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  addressInputContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  inputIconRight: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  suggestionsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  suggestionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  suggestionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    justifyContent: 'center',
  },
  suggestionsLoadingText: {
    fontSize: 12,
    color: Colors.muted,
    marginLeft: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: Colors.white,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  noSuggestionsRow: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  noSuggestionsText: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  halfInput: {
    flex: 0.48,
    marginBottom: 0,
  },
  rangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
  },
  rangeBannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  rangeBannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  rangeBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    lineHeight: 16,
  },
  rangeTextSuccess: {
    color: '#15803D',
  },
  rangeTextError: {
    color: '#DC2626',
  },
  savedAddressContainer: {
    marginBottom: Spacing.md,
  },
  savedAddressHeader: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  savedAddressScroll: {
    paddingBottom: 4,
  },
  savedAddressCard: {
    width: 200,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  savedAddressCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  savedAddressRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  savedAddressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  savedAddressLabelSelected: {
    color: Colors.primary,
  },
  savedDefaultBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  savedDefaultText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
  },
  savedAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  savedAddressSub: {
    fontSize: 11,
    color: Colors.muted,
  },
});
