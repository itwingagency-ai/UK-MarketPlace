import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import ASSETS from '../assets/3d';
import { Colors, Shadow } from '../theme';

// Category tile palettes from tokens.css (--color-cat-*)
const PALETTES = {
  mint: { bg: '#ECFDF5', fg: '#047857', accent: '#10B981' },
  amber: { bg: '#FFFBEB', fg: '#B45309', accent: '#F59E0B' },
  sky: { bg: '#F0F9FF', fg: '#0369A1', accent: '#0EA5E9' },
  coral: { bg: '#FFF1F2', fg: '#BE123C', accent: '#F43F5E' },
  violet: { bg: '#F5F3FF', fg: '#6D28D9', accent: '#8B5CF6' },
  teal: { bg: '#F0FDFA', fg: '#0F766E', accent: '#14B8A6' },
  cyan: { bg: '#ECFEFF', fg: '#0E7490', accent: '#06B6D4' },
  indigo: { bg: '#EEF2FF', fg: '#4338CA', accent: '#6366F1' },
  brand: { bg: Colors.primarySubtle, fg: Colors.primary, accent: '#8432E3' },
};

// Fallback icon + palette per asset name (used until the real render exists)
const FALLBACKS = {
  'cat-fruit-veg': ['feather', 'mint'],
  'cat-bakery': ['coffee', 'amber'],
  'cat-dairy-eggs': ['droplet', 'sky'],
  'cat-meat-fish': ['anchor', 'coral'],
  'cat-drinks': ['droplet', 'violet'],
  'cat-pharmacy': ['plus-square', 'teal'],
  'cat-frozen': ['cloud-snow', 'cyan'],
  'cat-household': ['home', 'indigo'],
  'cat-snacks-sweets': ['gift', 'coral'],
  'cat-alcohol': ['wind', 'violet'],
  'cat-off-licence': ['wind', 'violet'],
  'cat-baby': ['smile', 'sky'],
  'cat-pet': ['heart', 'amber'],
  'cat-health-beauty': ['star', 'coral'],
  'cat-breakfast': ['sunrise', 'amber'],
  'cat-world-foods': ['globe', 'mint'],
  'cat-ready-meals': ['clock', 'amber'],
  'cat-tea-coffee': ['coffee', 'amber'],
  'cat-tinned-cupboard': ['archive', 'indigo'],
  'cat-vegan': ['feather', 'mint'],
  'cat-flowers': ['sun', 'coral'],
  'cat-stationery': ['edit-3', 'indigo'],
  'cat-electronics': ['battery-charging', 'cyan'],
  'cat-halal': ['check-circle', 'mint'],
  'hero-delivery-scooter': ['truck', 'brand'],
  'hero-storefront': ['shopping-bag', 'brand'],
  'illo-empty-basket': ['shopping-bag', 'brand'],
  'illo-empty-favourites': ['heart', 'coral'],
  'illo-empty-catalogue': ['package', 'brand'],
  'illo-empty-notifications': ['bell', 'brand'],
  'illo-no-stores': ['map-pin', 'brand'],
  'illo-order-success': ['check-circle', 'mint'],
  'illo-search-empty': ['search', 'brand'],
  'illo-error-cone': ['alert-triangle', 'amber'],
  'badge-scooter-refresh': ['refresh-cw', 'brand'],
  'badge-otp-shield': ['shield', 'brand'],
  'badge-key-reset': ['key', 'brand'],
  'badge-promo-star': ['star', 'amber'],
};

/**
 * Category name → asset, for store categories that have no image of their own.
 */
const CATEGORY_KEYWORDS = [
  [/fruit|veg|salad|produce/i, 'cat-fruit-veg'],
  [/bak|bread|pastr|cake/i, 'cat-bakery'],
  [/dairy|milk|egg|cheese/i, 'cat-dairy-eggs'],
  [/meat|fish|chicken|butcher|burger/i, 'cat-meat-fish'],
  [/drink|juice|soda|water|beverage/i, 'cat-drinks'],
  [/pharm|health|medic/i, 'cat-pharmacy'],
  [/frozen|ice/i, 'cat-frozen'],
  [/house|clean/i, 'cat-household'],
  [/snack|sweet|choc|crisp|candy/i, 'cat-snacks-sweets'],
  [/beer|wine|alcohol|spirit/i, 'cat-alcohol'],
  [/baby/i, 'cat-baby'],
  [/pet/i, 'cat-pet'],
  [/beauty|cosmetic/i, 'cat-health-beauty'],
  [/breakfast|cereal/i, 'cat-breakfast'],
  [/tea|coffee/i, 'cat-tea-coffee'],
  [/ready|meal/i, 'cat-ready-meals'],
  [/tin|cupboard|pantry/i, 'cat-tinned-cupboard'],
  [/vegan/i, 'cat-vegan'],
  [/halal/i, 'cat-halal'],
];

export function assetForCategory(name = '') {
  const hit = CATEGORY_KEYWORDS.find(([re]) => re.test(name));
  return hit ? hit[1] : 'cat-tinned-cupboard';
}

export function paletteForAsset(name) {
  const [, paletteKey] = FALLBACKS[name] || ['box', 'brand'];
  return PALETTES[paletteKey];
}

/**
 * A pre-rendered 3D object, or a morphic placeholder tile until the render exists.
 *
 * Props:
 *   name     – asset file name without extension (e.g. 'cat-bakery')
 *   size     – rendered size in pt (default 56)
 *   float    – gentle idle float loop (respects reduced motion)
 *   delay    – float phase offset in ms
 */
export default function Asset3D({ name, size = 56, float = false, delay = 0, style }) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!float || reduceMotion) return;
    offset.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [float, delay, reduceMotion, offset]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const source = ASSETS[name];

  if (source) {
    return (
      <Animated.View style={[floatStyle, style]}>
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    );
  }

  const [icon, paletteKey] = FALLBACKS[name] || ['box', 'brand'];
  const palette = PALETTES[paletteKey];
  const radius = size * 0.3;

  return (
    <Animated.View style={[floatStyle, style]}>
      <View
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: palette.bg,
            shadowColor: palette.accent,
          },
        ]}
      >
        {/* Soft top highlight + bottom shade give the clay tile its depth */}
        <View style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
        <View
          style={[
            styles.orb,
            {
              width: size * 0.62,
              height: size * 0.62,
              borderRadius: size * 0.31,
              backgroundColor: palette.accent,
            },
          ]}
        >
          <View style={[styles.orbShine, { width: size * 0.2, height: size * 0.12, borderRadius: size * 0.1 }]} />
          <Feather name={icon} size={size * 0.3} color={Colors.white} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...Shadow.morphic3d,
    shadowOpacity: 0.28,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  orbShine: {
    position: 'absolute',
    top: '14%',
    left: '20%',
    backgroundColor: 'rgba(255,255,255,0.45)',
    transform: [{ rotate: '-25deg' }],
  },
});
