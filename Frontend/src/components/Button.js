import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, HitTarget, Motion, Radius, Shadow, Spacing, Typography } from '../theme';

/**
 * Button variants:
 *   primary   — solid brand purple (main call to action)
 *   secondary — soft purple tint
 *   outline   — bordered, surface background
 *   ghost     — text-only
 *   danger    — solid red, for destructive actions only
 *
 * Presses scale to 0.96 on the "snappy" spring from the design system.
 */
const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const spinnerColor = variant === 'primary' || variant === 'danger' ? Colors.white : Colors.primary;

  return (
    <Animated.View style={[animatedStyle, size === 'full' && styles.fullWidth, style]}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => { scale.value = withSpring(0.96, Motion.springs.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, Motion.springs.snappy); }}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.base,
          styles[variant],
          styles[`size_${size}`],
          isDisabled && styles.disabled,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={spinnerColor} size="small" />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.label,
                styles[`label_${variant}`],
                styles[`labelSize_${size}`],
                icon ? { marginLeft: Spacing.sm } : null,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  fullWidth: { width: '100%' },
  // Variants
  primary: {
    backgroundColor: Colors.primary,
    ...Shadow.morphic3d,
  },
  secondary: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  outline: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.accent,
  },
  // Sizes
  size_sm: { minHeight: 36, paddingHorizontal: Spacing.md },
  size_md: { minHeight: HitTarget.minMobile, paddingHorizontal: Spacing.lg },
  size_lg: { minHeight: HitTarget.comfortableMobile + 4, paddingHorizontal: Spacing.xl },
  size_full: { minHeight: HitTarget.comfortableMobile + 4, width: '100%' },
  // Labels
  label: {
    fontFamily: Typography.family.bold,
    letterSpacing: 0.1,
  },
  label_primary: { color: Colors.white },
  label_secondary: { color: Colors.primary },
  label_outline: { color: Colors.text },
  label_ghost: { color: Colors.primary },
  label_danger: { color: Colors.white },
  labelSize_sm: { fontSize: Typography.size.sm },
  labelSize_md: { fontSize: Typography.size.md },
  labelSize_lg: { fontSize: Typography.size.lg },
  labelSize_full: { fontSize: Typography.size.lg },
  // Disabled
  disabled: { opacity: 0.45 },
});

export default Button;
