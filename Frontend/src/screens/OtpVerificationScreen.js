import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius } from '../theme';

export default function OtpVerificationScreen({ route, navigation }) {
  const { email, mode } = route.params; // mode: 'signup' | 'forgot_password'
  const { verifySignup, isLoading: authLoading } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    if (mode === 'signup') {
      setIsSubmitting(true);
      const result = await verifySignup(email, otp);
      setIsSubmitting(false);

      if (!result.success) {
        setError(result.error || 'Verification failed');
      }
    } else if (mode === 'forgot_password') {
      // Proceed to reset password screen with verified email and OTP
      navigation.navigate('ResetPassword', { email, otp });
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.headerBlock}>
            <Text style={styles.welcomeLabel}>Verification</Text>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.tagline}>
              We've sent a 6-digit verification code to {email}.
            </Text>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={[
              styles.inputContainer,
              error ? styles.inputContainerError : null,
            ]}>
              <Text style={styles.inputIcon}>🔢</Text>
              <TextInput
                style={styles.textInput}
                placeholder="000000"
                placeholderTextColor={Colors.muted}
                value={otp}
                onChangeText={(t) => { setOtp(t); setError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                autoCorrect={false}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.btnText}>Verify Code</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  safeArea: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Platform.OS === 'android' ? Spacing.lg : 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backIcon: { fontSize: 20, color: Colors.text, fontWeight: '600' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
  },
  headerBlock: { marginBottom: Spacing['2xl'] },
  welcomeLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  fieldWrapper: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.size.xs,
    marginTop: Spacing.xs,
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: Spacing.lg,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
});
