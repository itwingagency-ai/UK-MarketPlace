import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors, Motion, Radius, Spacing, Typography } from '../theme';

/**
 * Text input with an animated focus border and glow.
 * secureTextEntry adds a show/hide toggle.
 */
const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  leftIcon,
  error,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const focus = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [Colors.border, Colors.primary]),
    shadowOpacity: focus.value * 0.18,
  }));

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.container, containerStyle, error && styles.containerError]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onFocus={(e) => {
            focus.value = withSpring(1, Motion.springs.snappy);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withSpring(0, Motion.springs.snappy);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            style={styles.eyeButton}
            onPress={() => setIsPasswordVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Feather name={isPasswordVisible ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </Animated.View>
      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color={Colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.base,
  },
  label: {
    fontFamily: Typography.family.semibold,
    fontSize: Typography.size.sm,
    color: Colors.text,
    marginBottom: Spacing.xs + 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0,
  },
  containerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorBg,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: Typography.family.regular,
    fontSize: Typography.size.md,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs + 2,
  },
  errorText: {
    fontFamily: Typography.family.medium,
    color: Colors.errorText,
    fontSize: Typography.size.xs + 1,
  },
});

export default Input;
