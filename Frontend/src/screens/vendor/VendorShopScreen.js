import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCustomAlert } from '../../context/AlertContext';
import { getStoreSettings } from '../../api/vendor.api';
import { getStoreBySlug } from '../../api/stores.api';
import { ScreenHeader, Card, SectionTitle, sharedStyles } from '../../components/vendor/VendorUI';
import { apiError } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

function MenuRow({ icon, label, help, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <View style={[styles.menuIcon, danger && { backgroundColor: Colors.errorBg }]}>
        <Feather name={icon} size={18} color={danger ? Colors.errorText : Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: Colors.errorText }]}>{label}</Text>
        {help ? <Text style={sharedStyles.help}>{help}</Text> : null}
      </View>
      {!danger ? <Feather name="chevron-right" size={18} color={Colors.muted} /> : null}
    </Pressable>
  );
}

export default function VendorShopScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { showAlert } = useCustomAlert();
  const [store, setStore] = useState(null);

  useFocusEffect(useCallback(() => {
    getStoreSettings().then((res) => setStore(res.data)).catch(() => {});
  }, []));

  const preview = async () => {
    if (!store?.slug) return;
    try {
      const res = await getStoreBySlug(store.slug);
      navigation.navigate('StoreCategories', { store: res.data });
    } catch (err) {
      showAlert({
        title: "Can't open your shop page",
        message: apiError(err, 'Your shop may not be live yet. Please contact support.'),
        icon: 'alert-circle',
        showCancel: false,
        confirmText: 'OK',
      });
    }
  };

  const confirmLogout = () =>
    showAlert({ title: 'Log out?', message: 'You can log back in any time.', confirmText: 'Log out', icon: 'log-out', onConfirm: logout });

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="My shop" />
      <ScrollView contentContainerStyle={sharedStyles.content}>
        <Card style={styles.storeCard}>
          {store?.bannerUrl ? <Image source={{ uri: store.bannerUrl }} style={styles.banner} /> : <View style={[styles.banner, styles.bannerEmpty]} />}
          <View style={styles.storeInfo}>
            <View style={styles.logo}>
              {store?.logoUrl ? (
                <Image source={{ uri: store.logoUrl }} style={styles.logoImg} />
              ) : (
                <Text style={styles.logoLetter}>{(store?.storeName || 'S')[0].toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName} numberOfLines={1}>{store?.storeName || 'Your shop'}</Text>
              <Text style={sharedStyles.help} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Shop settings</SectionTitle>
        <Card style={{ paddingVertical: Spacing.xs }}>
          <MenuRow icon="edit-3" label="Shop details" help="Name, description, contact, logo and banner" onPress={() => navigation.navigate('VendorStoreDetails')} />
          <MenuRow icon="clock" label="Opening hours" help="When customers can order" onPress={() => navigation.navigate('VendorHours')} />
          <MenuRow icon="eye" label="See my shop as customers do" onPress={preview} />
        </Card>

        <SectionTitle>Catalogue</SectionTitle>
        <Card style={{ paddingVertical: Spacing.xs }}>
          <MenuRow icon="folder" label="Categories" onPress={() => navigation.navigate('VendorCategories')} />
          <MenuRow icon="layers" label="Stock levels" onPress={() => navigation.navigate('VendorInventory')} />
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card style={{ paddingVertical: Spacing.xs }}>
          <MenuRow icon="help-circle" label="Help center" onPress={() => navigation.navigate('HelpCenter')} />
          <MenuRow icon="file-text" label="Terms & policies" onPress={() => navigation.navigate('TermsPolicies')} />
          <MenuRow icon="log-out" label="Log out" danger onPress={confirmLogout} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  storeCard: { padding: 0, overflow: 'hidden' },
  banner: { width: '100%', height: 110 },
  bannerEmpty: { backgroundColor: Colors.primaryLight },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base },
  logo: {
    width: 54,
    height: 54,
    borderRadius: Radius.lg,
    marginTop: -40,
    borderWidth: 3,
    borderColor: Colors.surface,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoLetter: { fontFamily: Typography.family.displayExtrabold, fontSize: 22, color: Colors.white },
  storeName: { fontFamily: Typography.family.displayExtrabold, fontSize: 18, color: Colors.text },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
  },
  menuLabel: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
});
