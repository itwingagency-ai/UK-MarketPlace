import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { getMyApplication, submitApplication } from '../api/vendor.api';
import Input from '../components/Input';
import Button from '../components/Button';
import { ScreenHeader, Card, Loading, sharedStyles } from '../components/vendor/VendorUI';
import { apiError } from '../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../theme';

const toSlug = (text) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Customers apply to open a shop here. An admin reviews the application;
 * once approved the same account switches to the shopkeeper app.
 */
export default function BecomeSellerScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const { showAlert } = useCustomAlert();
  const [application, setApplication] = useState(undefined); // undefined = loading
  const [form, setForm] = useState({ storeName: '', slug: '', description: '', phone: '', line1: '', city: '', postalCode: '' });
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyApplication();
      setApplication(res.data);
    } catch {
      setApplication(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (v) =>
    setForm((prev) => ({
      ...prev,
      [key]: v,
      ...(key === 'storeName' && !slugEdited ? { slug: toSlug(v) } : {}),
    }));

  const submit = async () => {
    if (form.storeName.trim().length < 2) {
      showAlert({ title: 'Shop name needed', message: 'Enter your shop name.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
      return;
    }
    if (toSlug(form.slug).length < 2) {
      showAlert({ title: 'Web address needed', message: 'Use letters and numbers, e.g. "rosies-bakery".', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitApplication({
        storeName: form.storeName.trim(),
        slug: toSlug(form.slug),
        description: form.description.trim(),
        contact: { phone: form.phone.trim(), email: user?.email || '' },
        address: { line1: form.line1.trim(), city: form.city.trim(), postalCode: form.postalCode.trim(), country: 'United Kingdom' },
      });
      setApplication(res.data);
    } catch (err) {
      showAlert({ title: "Couldn't send application", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setSubmitting(false);
    }
  };

  // Approved accounts become shopkeepers; re-reading the profile swaps the app over
  const openShop = async () => {
    setChecking(true);
    const fresh = await refreshUser();
    setChecking(false);
    if (fresh?.role !== 'vendor') {
      showAlert({ title: 'Not ready yet', message: 'Your shop is still being set up. Please try again shortly.', icon: 'clock', showCancel: false, confirmText: 'OK' });
    }
  };

  const header = <ScreenHeader title="Sell on UK Marketplace" onBack={() => navigation.goBack()} />;

  if (application === undefined) {
    return <View style={sharedStyles.screen}>{header}<Loading /></View>;
  }

  if (application && application.status !== 'rejected') {
    const approved = application.status === 'approved';
    return (
      <View style={sharedStyles.screen}>
        {header}
        <ScrollView contentContainerStyle={sharedStyles.content}>
          <Card style={styles.statusCard}>
            <View style={[styles.statusIcon, approved && { backgroundColor: Colors.successBg }]}>
              <Feather name={approved ? 'check-circle' : 'clock'} size={30} color={approved ? Colors.successText : Colors.primary} />
            </View>
            <Text style={styles.statusTitle}>{approved ? 'Your shop is approved!' : 'Application under review'}</Text>
            <Text style={styles.statusBody}>
              {approved
                ? `"${application.storeName}" is ready. Open your shop to add categories, products and photos.`
                : `We're reviewing "${application.storeName}". You can keep shopping meanwhile — check back here for updates.`}
            </Text>
            {approved ? (
              <Button title="Open my shop" size="full" loading={checking} onPress={openShop} style={{ marginTop: Spacing.lg }} />
            ) : (
              <Button title="Check again" variant="outline" size="full" onPress={async () => { await load(); await refreshUser(); }} style={{ marginTop: Spacing.lg }} />
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={sharedStyles.screen}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Lives inside the Account tab, so the button scrolls with the form
            rather than sitting under the floating tab bar */}
        <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled">
          {application?.status === 'rejected' ? (
            <Card style={[styles.notice, { backgroundColor: Colors.errorBg }]}>
              <Text style={styles.noticeTitle}>Your last application wasn't approved</Text>
              {application.adminNote ? <Text style={sharedStyles.help}>{application.adminNote}</Text> : null}
              <Text style={sharedStyles.help}>You can update the details and apply again.</Text>
            </Card>
          ) : (
            <Card style={styles.notice}>
              <Text style={styles.noticeTitle}>Run your shop from this app</Text>
              <Text style={sharedStyles.help}>
                Tell us about your shop. Once approved you can add categories, products, sizes, prices, photos and stock — and manage orders — right here.
              </Text>
            </Card>
          )}
          <Card style={{ marginTop: Spacing.md }}>
            <Input label="Shop name *" placeholder="e.g. Rosie's Bakery" value={form.storeName} onChangeText={set('storeName')} autoCapitalize="words" />
            <Input
              label="Shop web address *"
              placeholder="rosies-bakery"
              value={form.slug}
              onChangeText={(v) => { setSlugEdited(true); set('slug')(toSlug(v)); }}
            />
            <Text style={[sharedStyles.help, { marginTop: -Spacing.sm, marginBottom: Spacing.base }]}>Customers find your shop at this name. Letters, numbers and hyphens.</Text>
            <Input
              label="What do you sell?"
              placeholder="e.g. Fresh cakes, traditional sweets and bakery goods"
              value={form.description}
              onChangeText={set('description')}
              autoCapitalize="sentences"
              multiline
              inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <Input label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Input label="Shop address" placeholder="Street and number" value={form.line1} onChangeText={set('line1')} autoCapitalize="words" />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Input style={{ flex: 1 }} label="Town / city" value={form.city} onChangeText={set('city')} autoCapitalize="words" />
              <Input style={{ flex: 1 }} label="Postcode" value={form.postalCode} onChangeText={set('postalCode')} autoCapitalize="characters" />
            </View>
          </Card>
          <Button title="Send application" size="full" loading={submitting} onPress={submit} style={{ marginTop: Spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: { alignItems: 'center', paddingVertical: Spacing.xl },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  statusTitle: { fontFamily: Typography.family.displayExtrabold, fontSize: 20, color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
  statusBody: { fontFamily: Typography.family.regular, fontSize: 14, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs },
  notice: { gap: 4, backgroundColor: Colors.primarySubtle, borderColor: Colors.primaryLight, borderRadius: Radius.xl },
  noticeTitle: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
});
