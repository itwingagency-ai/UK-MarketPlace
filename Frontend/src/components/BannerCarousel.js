import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, useWindowDimensions } from 'react-native';
import { getBanners } from '../api/app.api';
import { openTarget } from '../utils/deepLinks';
import { useCart } from '../context/CartContext';
import { useCustomAlert } from '../context/AlertContext';
import { Colors, Spacing, Typography, Radius } from '../theme';

/** Admin-managed home banners for where the customer is. Renders nothing when there are none. */
export default function BannerCarousel({ lat, lng }) {
  const [banners, setBanners] = useState([]);
  const { width } = useWindowDimensions();
  const { applyCoupon } = useCart();
  const { showAlert } = useCustomAlert();

  useEffect(() => {
    let alive = true;
    getBanners({ lat, lng }).then((b) => alive && setBanners(Array.isArray(b) ? b : [])).catch(() => {});
    return () => { alive = false; };
  }, [lat, lng]);

  if (banners.length === 0) return null;
  const cardWidth = width - Spacing.base * 2;

  return (
    <ScrollView
      horizontal
      pagingEnabled={banners.length > 1}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + Spacing.sm}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md }}
    >
      {banners.map((b) => (
        <Pressable
          key={b._id}
          style={[styles.card, { width: cardWidth }]}
          disabled={!b.target || b.target.type === 'none'}
          onPress={() =>
            openTarget(b.target, {
              applyCoupon,
              onMessage: (title, message) => showAlert({ title, message, showCancel: false, confirmText: 'OK' }),
            })
          }
          accessibilityRole={b.target?.type && b.target.type !== 'none' ? 'button' : undefined}
          accessibilityLabel={b.title}
        >
          {b.imageUrl ? <Image source={{ uri: b.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={[styles.text, b.imageUrl && styles.textOnImage]}>
            <Text style={[styles.title, b.imageUrl && styles.light]} numberOfLines={2}>{b.title}</Text>
            {b.subtitle ? <Text style={[styles.subtitle, b.imageUrl && styles.light]} numberOfLines={2}>{b.subtitle}</Text> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { height: 140, borderRadius: Radius['2xl'], overflow: 'hidden', backgroundColor: Colors.primary, justifyContent: 'flex-end' },
  text: { padding: Spacing.base },
  textOnImage: { backgroundColor: 'rgba(0,0,0,0.35)' },
  title: { fontFamily: Typography.family.displayExtrabold, fontSize: 19, color: Colors.white },
  subtitle: { fontFamily: Typography.family.medium, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  light: { color: Colors.white },
});
