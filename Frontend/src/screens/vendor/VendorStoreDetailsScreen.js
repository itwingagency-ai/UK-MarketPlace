import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStoreSettings, updateStoreSettings } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { ScreenHeader, Card, Loading, sharedStyles } from '../../components/vendor/VendorUI';
import { apiError, imagePart } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

export default function VendorStoreDetailsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ storeName: '', description: '', contactEmail: '', contactPhone: '' });
  const [current, setCurrent] = useState({ logoUrl: '', bannerUrl: '' });
  const [logo, setLogo] = useState(null);
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStoreSettings()
      .then((res) => {
        const s = res.data;
        setForm({ storeName: s.storeName, description: s.description, contactEmail: s.contactEmail, contactPhone: s.contactPhone });
        setCurrent({ logoUrl: s.logoUrl, bannerUrl: s.bannerUrl });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const set = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const pick = async (aspect, setter) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      showAlert({ title: 'Image too large', message: 'Choose an image of 5 MB or smaller.', icon: 'image', showCancel: false, confirmText: 'OK' });
      return;
    }
    setter(asset);
  };

  const save = async () => {
    if (form.storeName.trim().length < 2) {
      showAlert({ title: 'Shop name needed', message: 'Enter a shop name of at least 2 letters.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
      return;
    }
    const body = new FormData();
    body.append('storeName', form.storeName.trim());
    body.append('description', form.description.trim());
    body.append('contactEmail', form.contactEmail.trim());
    body.append('contactPhone', form.contactPhone.trim());
    if (logo) body.append('logoImage', imagePart(logo, 'logo'));
    if (banner) body.append('bannerImage', imagePart(banner, 'banner'));

    setSaving(true);
    try {
      await updateStoreSettings(body);
      navigation.goBack();
    } catch (err) {
      showAlert({ title: "Couldn't save", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Shop details" onBack={() => navigation.goBack()} />
      {!loaded ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={sharedStyles.fieldLabel}>Banner</Text>
              <Pressable onPress={() => pick([16, 9], setBanner)} style={styles.banner} accessibilityLabel="Choose banner image">
                {banner?.uri || current.bannerUrl ? (
                  <Image source={{ uri: banner?.uri || current.bannerUrl }} style={styles.fill} />
                ) : (
                  <View style={styles.placeholder}><Feather name="image" size={22} color={Colors.primary} /><Text style={styles.placeholderText}>Choose banner</Text></View>
                )}
              </Pressable>
              <Text style={[sharedStyles.fieldLabel, { marginTop: Spacing.base }]}>Logo</Text>
              <Pressable onPress={() => pick([1, 1], setLogo)} style={styles.logo} accessibilityLabel="Choose logo">
                {logo?.uri || current.logoUrl ? (
                  <Image source={{ uri: logo?.uri || current.logoUrl }} style={styles.fill} />
                ) : (
                  <View style={styles.placeholder}><Feather name="image" size={20} color={Colors.primary} /><Text style={styles.placeholderText}>Logo</Text></View>
                )}
              </Pressable>
            </Card>
            <Card style={{ marginTop: Spacing.md }}>
              <Input label="Shop name *" value={form.storeName} onChangeText={set('storeName')} autoCapitalize="words" maxLength={120} />
              <Input
                label="About your shop"
                placeholder="What you sell, what makes you special…"
                value={form.description}
                onChangeText={set('description')}
                autoCapitalize="sentences"
                multiline
                inputStyle={{ minHeight: 90, textAlignVertical: 'top' }}
              />
              <Input label="Contact email" value={form.contactEmail} onChangeText={set('contactEmail')} keyboardType="email-address" />
              <Input label="Contact phone" value={form.contactPhone} onChangeText={set('contactPhone')} keyboardType="phone-pad" />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <View style={[styles.bar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button title="Save changes" size="full" loading={saving} onPress={save} disabled={!loaded} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.primarySubtle },
  logo: { width: 96, height: 96, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.primarySubtle },
  fill: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  placeholderText: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.primary },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
