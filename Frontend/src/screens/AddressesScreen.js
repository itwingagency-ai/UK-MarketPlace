import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import {
  getMyAddresses,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
} from '../api/profile.api';
import { useAuth } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';

// UK Address Suggestion Helper
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

export default function AddressesScreen({ navigation }) {
  const { user } = useAuth();
  const { showAlert } = useCustomAlert() || {};
  
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    label: 'Home',
    fullName: user?.name || '',
    phone: user?.phone || '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    lat: null,
    lng: null,
    isDefault: false,
  });

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyAddresses();
      setAddresses(res?.data || []);
    } catch (err) {
      setError('Failed to load addresses. Please try again.');
      console.log('Fetch addresses error:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [])
  );

  const handleOpenModal = (address = null) => {
    if (address) {
      setEditingAddressId(address._id);
      setForm({
        label: address.label || 'Home',
        fullName: address.fullName || user?.name || '',
        phone: address.phone || user?.phone || '',
        line1: address.line1 || '',
        line2: address.line2 || '',
        city: address.city || '',
        postalCode: address.postalCode || '',
        lat: address.lat || null,
        lng: address.lng || null,
        isDefault: address.isDefault || false,
      });
    } else {
      setEditingAddressId(null);
      setForm({
        label: 'Home',
        fullName: user?.name || '',
        phone: user?.phone || '',
        line1: '',
        line2: '',
        city: '',
        postalCode: '',
        lat: null,
        lng: null,
        isDefault: addresses.length === 0,
      });
    }
    setSuggestions([]);
    setModalVisible(true);
  };

  const handleAddressLine1Change = async (text) => {
    setForm((prev) => ({ ...prev, line1: text }));
    if (text.trim().length >= 3) {
      setIsSuggesting(true);
      const results = await fetchUKAddressSuggestions(text);
      setSuggestions(results);
      setIsSuggesting(false);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (item) => {
    setForm((prev) => ({
      ...prev,
      line1: item.line1 || prev.line1,
      city: item.city || prev.city,
      postalCode: item.postalCode || prev.postalCode,
      lat: item.lat != null ? item.lat : prev.lat,
      lng: item.lng != null ? item.lng : prev.lng,
    }));
    setSuggestions([]);
  };

  const handleSaveAddress = async () => {
    if (!form.line1?.trim() || !form.city?.trim() || !form.postalCode?.trim() || !form.phone?.trim()) {
      const msg = 'Please fill in your Phone Number, Street Address, City, and Postcode.';
      if (showAlert) showAlert('Validation Error', msg);
      else Alert.alert('Validation Error', msg);
      return;
    }

    try {
      setSubmitting(true);
      if (editingAddressId) {
        await updateMyAddress(editingAddressId, form);
      } else {
        await addMyAddress(form);
      }
      setModalVisible(false);
      fetchAddresses();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save address.';
      if (showAlert) showAlert('Error', msg);
      else Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAddress = (id) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to remove this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAddress(id);
              fetchAddresses();
            } catch (err) {
              const msg = err.response?.data?.message || 'Failed to delete address.';
              if (showAlert) showAlert('Error', msg);
              else Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (id) => {
    try {
      await updateMyAddress(id, { isDefault: true });
      fetchAddresses();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to set default address.';
      if (showAlert) showAlert('Error', msg);
      else Alert.alert('Error', msg);
    }
  };

  const renderAddressCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.labelRow}>
          <View style={[styles.labelBadge, item.label === 'Work' && styles.workBadge, item.label === 'Shipping' && styles.shippingBadge]}>
            <Feather
              name={item.label === 'Work' ? 'briefcase' : item.label === 'Shipping' ? 'truck' : 'home'}
              size={12}
              color={Colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.labelText}>{item.label || 'Home'}</Text>
          </View>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleOpenModal(item)} style={styles.iconBtn}>
            <Feather name="edit-2" size={16} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteAddress(item._id)} style={styles.iconBtn}>
            <Feather name="trash-2" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.fullName}>{item.fullName || user?.name || 'User'}</Text>
      <Text style={styles.addressLine}>{item.line1}</Text>
      {item.line2 ? <Text style={styles.addressLine}>{item.line2}</Text> : null}
      <Text style={styles.addressLine}>
        {item.city}, {item.postalCode}
      </Text>
      {item.phone ? <Text style={styles.phoneText}>Phone: {item.phone}</Text> : null}

      {!item.isDefault && (
        <TouchableOpacity style={styles.setDefaultBtn} onPress={() => handleSetDefault(item._id)}>
          <Text style={styles.setDefaultText}>Set as Default</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Addresses</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAddresses}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="location-outline" size={60} color={Colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Addresses Saved</Text>
          <Text style={styles.emptySubtitle}>
            Add a shipping address to speed up your checkout experience.
          </Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item._id}
          renderItem={renderAddressCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Address Floating Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => handleOpenModal()}>
          <Feather name="plus" size={20} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.addBtnText}>Add New Address</Text>
        </TouchableOpacity>
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAddressId ? 'Edit Address' : 'Add New Address'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Address Type</Text>
              <View style={styles.labelPickerRow}>
                {['Home', 'Work', 'Shipping'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, form.label === type && styles.typeBtnActive]}
                    onPress={() => setForm((prev) => ({ ...prev, label: type }))}
                  >
                    <Text style={[styles.typeBtnText, form.label === type && styles.typeBtnTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={Colors.muted}
                value={form.fullName}
                onChangeText={(text) => setForm((prev) => ({ ...prev, fullName: text }))}
              />

              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="+44 7123 456789"
                placeholderTextColor={Colors.muted}
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(text) => setForm((prev) => ({ ...prev, phone: text }))}
              />

              <Text style={styles.inputLabel}>Street Address (UK)</Text>
              <TextInput
                style={styles.input}
                placeholder="Start typing your street address..."
                placeholderTextColor={Colors.muted}
                value={form.line1}
                onChangeText={handleAddressLine1Change}
              />

              {isSuggesting && (
                <View style={styles.suggestingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.suggestingText}>Searching UK addresses...</Text>
                </View>
              )}

              {suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Feather name="map-pin" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Apartment, suite, etc. (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Apt 4B"
                placeholderTextColor={Colors.muted}
                value={form.line2}
                onChangeText={(text) => setForm((prev) => ({ ...prev, line2: text }))}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>City / Town</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="London"
                    placeholderTextColor={Colors.muted}
                    value={form.city}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, city: text }))}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Postcode</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="SW1A 1AA"
                    placeholderTextColor={Colors.muted}
                    autoCapitalize="characters"
                    value={form.postalCode}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, postalCode: text }))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setForm((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
              >
                <View style={[styles.checkbox, form.isDefault && styles.checkboxChecked]}>
                  {form.isDefault && <Feather name="check" size={14} color={Colors.white} />}
                </View>
                <Text style={styles.checkboxLabel}>Set as default shipping address</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAddress} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Address</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  safeArea: {
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: Typography.size.md,
    color: Colors.text,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginRight: 8,
  },
  workBadge: {
    backgroundColor: '#FEF3C7',
  },
  shippingBadge: {
    backgroundColor: '#E0E7FF',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  defaultBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  defaultText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 8,
  },
  fullName: {
    fontSize: Typography.size.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: Typography.size.sm,
    color: '#4B5563',
    lineHeight: 20,
  },
  phoneText: {
    fontSize: Typography.size.sm,
    color: '#6B7280',
    marginTop: 4,
  },
  setDefaultBtn: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'flex-start',
  },
  setDefaultText: {
    fontSize: Typography.size.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    ...Shadow.md,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  inputLabel: {
    fontSize: Typography.size.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  labelPickerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    marginRight: 8,
    backgroundColor: '#F9FAFB',
  },
  typeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  typeBtnText: {
    fontSize: Typography.size.sm,
    color: '#4B5563',
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: Typography.size.md,
    color: Colors.text,
    backgroundColor: '#FFFFFF',
  },
  suggestingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  suggestingText: {
    fontSize: Typography.size.xs,
    color: Colors.muted,
    marginLeft: 8,
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: Radius.md,
    marginTop: 4,
    backgroundColor: Colors.white,
    maxHeight: 180,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: Typography.size.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadow.sm,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontWeight: '700',
  },
});
