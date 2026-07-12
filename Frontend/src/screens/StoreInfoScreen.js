import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

export default function StoreInfoScreen({ route, navigation }) {
  const { store } = route.params ?? {};
  const [hoursExpanded, setHoursExpanded] = useState(false);

  // Address
  const addressString = [
    store?.address?.line1,
    store?.address?.line2,
    store?.address?.city,
    store?.address?.state,
    store?.address?.postalCode,
  ].filter(Boolean).join(', ');

  // Map Image Placeholder (Since react-native-maps is not installed, use static OSM maps or a placeholder)
  // For production, use actual map component. Here we use an OpenStreetMap static image.
  const lat = store?.location?.coordinates?.[1] || 0;
  const lng = store?.location?.coordinates?.[0] || 0;

  // A free Yandex static map service
  const mapUrl = `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lng},${lat}&z=15&l=map&pt=${lng},${lat},pm2rdl`;

  const hasCoordinates = lat !== 0 && lng !== 0;

  // Formatting hours
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr;
  };

  const city = store?.address?.city || '';
  const storeNameWithCity = `${store?.name || 'Store Info'}${city ? ` - ${city}` : ''}`;

  const renderHoursList = () => {
    const operatingHours = store?.operatingHours || {};
    return DAYS_OF_WEEK.map((day) => {
      const slot = operatingHours[day];
      const isClosed = !slot || slot.isClosed;
      const timeStr = isClosed ? 'Closed' : `${formatTime(slot.open)} - ${formatTime(slot.close)}`;
      return (
        <View key={day} style={styles.hourRow}>
          <Text style={styles.hourDayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
          <Text style={styles.hourTimeText}>{timeStr}</Text>
        </View>
      );
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar translucent={false} backgroundColor={Colors.white} barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{storeNameWithCity}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Hours Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.hoursHeader}
              activeOpacity={0.7}
              onPress={() => setHoursExpanded(!hoursExpanded)}
            >
              <Feather name="clock" size={20} color={Colors.text} style={styles.sectionIcon} />
              <View style={styles.hoursTextContainer}>
                <Text style={styles.hoursStatusText}>
                  {store?.isOpen ? `Now open until ${store?.closesAt || 'late'}` : `Closed • ${store?.nextOpenDay ? 'Opens ' + store.nextOpenDay + ' ' + store.nextOpenTime : ''}`}
                </Text>
              </View>
              <View style={styles.toggleBtn}>
                <Text style={styles.toggleBtnText}>{hoursExpanded ? 'View less' : 'View more'}</Text>
                <Feather name={hoursExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.text} />
              </View>
            </TouchableOpacity>

            {hoursExpanded && (
              <View style={styles.hoursListContainer}>
                {renderHoursList()}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Location Section */}
          <View style={styles.section}>
            <View style={styles.locationHeader}>
              <Feather name="map-pin" size={20} color={Colors.text} style={styles.sectionIcon} />
              <Text style={styles.addressText}>{addressString || 'Address not available'}</Text>
            </View>

            {hasCoordinates ? (
              <View style={styles.mapContainer}>
                <Image source={{ uri: mapUrl }} style={styles.mapImage} />
              </View>
            ) : (
              <View style={[styles.mapContainer, styles.mapPlaceholder]}>
                <Text style={styles.mapPlaceholderText}>Map preview not available</Text>
              </View>
            )}
          </View>

          {/* Info Blocks */}
          <View style={styles.infoBlocksContainer}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoTitle}>Delivery fee</Text>
              <Text style={styles.infoDesc}>
                {store?.deliveryFee != null ? `Starting from £${store.deliveryFee.toFixed(2)}. ` : ''}
                Delivery fee is charged based on time of day, distance and surge conditions.
              </Text>
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.infoTitle}>Minimum order</Text>
              <Text style={styles.infoDesc}>
                For orders below £10.00, we charge a small order fee.
              </Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  safeArea: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },

  scrollContent: {
    paddingBottom: Spacing['3xl'],
  },

  section: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  sectionIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },

  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hoursTextContainer: {
    flex: 1,
  },
  hoursStatusText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 4,
  },

  hoursListContainer: {
    marginTop: Spacing.md,
    marginLeft: 36, // align with text, compensating for icon
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hourDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  hourTimeText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  divider: {
    height: 8,
    backgroundColor: Colors.surface,
  },

  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 22,
  },

  mapContainer: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  mapImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    color: Colors.muted,
  },

  infoBlocksContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  infoBlock: {
    marginBottom: Spacing.xl,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
