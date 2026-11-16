import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Linking, Platform, TextInput, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { getDelivery, pickUp, deliver } from '../../api/rider.api';
import { useCustomAlert } from '../../context/AlertContext';
import { useLiveEvent } from '../../context/NotificationsContext';
import Button from '../../components/Button';
import { ScreenHeader, Card, SectionTitle, Pill, Loading, EmptyState, Chip, ChipRow, sharedStyles } from '../../components/vendor/VendorUI';
import { formatPence } from '../../components/ProductCard';
import { slotText } from '../vendor/orderStatus';
import { apiError } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const ID_TYPES = [
  ['passport', 'Passport'],
  ['driving_licence', 'Driving licence'],
  ['pass_card', 'PASS card'],
  ['other_photo_id', 'Other photo ID'],
];

const openMaps = (a) => {
  const q = a.lat != null && a.lng != null ? `${a.lat},${a.lng}` : [a.line1, a.city, a.postalCode].filter(Boolean).join(', ');
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?daddr=${encodeURIComponent(q)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  Linking.openURL(url).catch(() => {});
};

/**
 * One delivery: where to go, what's in it, pick up, then hand over with
 * proof. Age-restricted orders need a photo-ID check, or the restricted
 * items are refused (refunded, back to the store) and the rest delivered.
 */
export default function RiderDeliveryScreen({ navigation, route }) {
  const { orderId } = route.params;
  const { showAlert } = useCustomAlert();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [idType, setIdType] = useState(null);
  const [refuse, setRefuse] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getDelivery(orderId));
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load this delivery"));
    }
  }, [orderId]);
  useEffect(() => { load(); }, [load]);
  useLiveEvent('order:status_changed', (p) => { if (p?.orderId === String(orderId)) load(); });

  const fail = (title, err) =>
    showAlert({ title, message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });

  const doPickUp = async () => {
    setBusy(true);
    try {
      await pickUp(orderId);
      await load();
    } catch (err) {
      fail("Couldn't pick up", err);
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      fail('Camera needed', { message: 'Allow the camera to take a doorstep photo.' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!result.canceled && result.assets?.[0]?.uri) setPhoto(result.assets[0].uri);
  };

  const doDeliver = async () => {
    if (!photo && !recipient.trim()) {
      fail('Proof needed', { message: 'Take a doorstep photo or enter who took the order.' });
      return;
    }
    if (order.ageCheck && !refuse && !idType) {
      fail('ID check needed', { message: `Check photo ID for the over-${order.ageCheck} items, or hand over without them.` });
      return;
    }
    setBusy(true);
    try {
      const res = await deliver(orderId, {
        photoUri: photo,
        recipientName: recipient.trim(),
        ageVerified: Boolean(order.ageCheck && !refuse && idType),
        idType: !refuse ? idType : null,
        refuseRestricted: Boolean(order.ageCheck && refuse),
      });
      showAlert({ title: 'Done', message: res.message, icon: 'check-circle', showCancel: false, confirmText: 'OK', onConfirm: () => navigation.goBack() });
    } catch (err) {
      fail("Couldn't complete delivery", err);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <View style={sharedStyles.screen}><ScreenHeader title="Delivery" onBack={() => navigation.goBack()} /><EmptyState icon="alert-circle" title="Something went wrong" body={error} actionLabel="Try again" onAction={load} /></View>;
  if (!order) return <View style={sharedStyles.screen}><ScreenHeader title="Delivery" onBack={() => navigation.goBack()} /><Loading /></View>;

  const a = order.shippingAddress || {};
  const store = order.store || {};
  const cashDue = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid';

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title={`#${order.orderNumber}`} subtitle={slotText(order.fulfilment)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 160, gap: Spacing.sm }]}>
        <Card style={{ gap: 6 }}>
          <Text style={sharedStyles.help}>Deliver to</Text>
          <Text style={styles.big}>{a.fullName || 'Customer'}</Text>
          <Text style={styles.body}>{[a.line1, a.line2, a.city, a.postalCode].filter(Boolean).join(', ')}</Text>
          {order.customerNote ? <Text style={[styles.body, { color: Colors.warningText }]}>Note: {order.customerNote}</Text> : null}
          <View style={styles.actions}>
            <Button title="Directions" variant="outline" onPress={() => openMaps(a)} icon={<Feather name="navigation" size={16} color={Colors.primary} />} style={{ flex: 1 }} />
            {a.phone ? <Button title="Call" variant="outline" onPress={() => Linking.openURL(`tel:${a.phone}`)} icon={<Feather name="phone" size={16} color={Colors.primary} />} style={{ flex: 1 }} /> : null}
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          <Text style={sharedStyles.help}>Pick up from</Text>
          <Text style={styles.big}>{store.name}</Text>
          <Text style={styles.body}>{[store.address?.line1, store.address?.city, store.address?.postalCode].filter(Boolean).join(', ')}</Text>
        </Card>

        <View style={styles.pills}>
          {cashDue ? <Pill label={`Collect ${formatPence(order.total)} cash`} tone="warning" /> : <Pill label="Paid" tone="success" />}
          {order.ageCheck ? <Pill label={`ID check: ${order.ageCheck}+`} tone="danger" /> : null}
        </View>

        <SectionTitle>Items</SectionTitle>
        <Card style={{ gap: 6 }}>
          {order.items.map((it, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.body, ['unavailable', 'refused'].includes(it.lineStatus) && styles.struck]}>
                {it.quantity} × {it.title}{it.minAge ? ` (${it.minAge}+)` : ''}
              </Text>
              {it.lineStatus !== 'ok' ? <Text style={sharedStyles.help}>{it.lineStatus}{it.substitutedFor ? ` for ${it.substitutedFor}` : ''}</Text> : null}
            </View>
          ))}
        </Card>

        {order.orderStatus === 'shipped' ? (
          <>
            <SectionTitle>Hand over</SectionTitle>
            <Card style={{ gap: Spacing.md }}>
              <Pressable onPress={takePhoto} style={styles.photo} accessibilityLabel="Take a doorstep photo">
                {photo ? <Image source={{ uri: photo }} style={styles.photoImg} /> : (
                  <>
                    <Feather name="camera" size={22} color={Colors.textSecondary} />
                    <Text style={sharedStyles.help}>Doorstep photo</Text>
                  </>
                )}
              </Pressable>
              <TextInput
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Who took it? (e.g. Sam, or neighbour at no. 3)"
                placeholderTextColor={Colors.muted}
                style={styles.input}
                maxLength={80}
              />
              {order.ageCheck ? (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={styles.label}>Photo ID checked ({order.ageCheck}+)</Text>
                  <ChipRow>
                    {ID_TYPES.map(([key, label]) => (
                      <Chip key={key} label={label} active={!refuse && idType === key} onPress={() => { setRefuse(false); setIdType(key); }} />
                    ))}
                  </ChipRow>
                  <Chip label={`No valid ID: keep the ${order.ageCheck}+ items`} active={refuse} onPress={() => { setRefuse(!refuse); setIdType(null); }} icon="x-circle" />
                </View>
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {['confirmed', 'packed'].includes(order.orderStatus) ? (
          <Button title="Picked up · start delivery" size="lg" loading={busy} onPress={doPickUp} icon={<Feather name="truck" size={18} color={Colors.white} />} />
        ) : order.orderStatus === 'shipped' ? (
          <Button title={cashDue ? `Delivered · ${formatPence(order.total)} taken` : 'Delivered'} size="lg" loading={busy} onPress={doDeliver} icon={<Feather name="check-circle" size={18} color={Colors.white} />} />
        ) : order.orderStatus === 'pending' ? (
          <Text style={[sharedStyles.help, { textAlign: 'center' }]}>Waiting for the store to accept this order</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontFamily: Typography.family.bold, fontSize: 17, color: Colors.text },
  body: { fontFamily: Typography.family.regular, fontSize: 14, color: Colors.text },
  label: { fontFamily: Typography.family.semibold, fontSize: 14, color: Colors.text },
  struck: { textDecorationLine: 'line-through', color: Colors.muted },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  pills: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  item: { gap: 2 },
  photo: {
    height: 160,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  input: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontFamily: Typography.family.regular,
    fontSize: 15,
    color: Colors.text,
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.base, paddingBottom: Spacing.xl, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
});
