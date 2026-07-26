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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

export default function OtpVerificationScreen({ route, navigation }) {
  const { email, mode } = route.params; // mode: 'signup' | 'forgot_password'
  const { verifySignup, verifyResetOtp, resendSignupOtp, forgotPassword, isLoading: authLoading } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState(60);
  const [isResending, setIsResending] = useState(false);

  React.useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const handleResend = async () => {
    if (timeLeft > 0) return;
    setIsResending(true);
    setError('');
    
    let result;
    if (mode === 'signup') {
      result = await resendSignupOtp(email);
    } else {
      result = await forgotPassword(email);
    }
    
    setIsResending(false);
    if (result.success) {
      setTimeLeft(60);
    } else {
      setError(result.error || 'Failed to resend code');
    }
  };

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
      setIsSubmitting(true);
      const result = await verifyResetOtp(email, otp);
      setIsSubmitting(false);

      if (result.success) {
        navigation.navigate('ResetPassword', { email, otp });
      } else {
        setError(result.error || 'Invalid or expired OTP');
      }
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Check your email</Text>
            <Text style={styles.headerSubtitle}>Verification</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.headerBlock}>
            <Text style={styles.tagline}>
              We've sent a 6-digit verification code to {email}.
            </Text>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={[
              styles.otpInputContainer,
              isFocused ? styles.inputContainerFocused : null,
              error ? styles.inputContainerError : null,
            ]}>
              <TextInput
                style={styles.otpTextInput}
                placeholder="000000"
                placeholderTextColor={Colors.border}
                value={otp}
                onChangeText={(t) => { setOtp(t); setError(''); }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                keyboardType="number-pad"
                maxLength={6}
                autoCorrect={false}
                autoFocus={true}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.btn, (otp.length < 6 || isLoading) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={otp.length < 6 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.btnText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive a code? </Text>
            <TouchableOpacity onPress={handleResend} disabled={timeLeft > 0 || isResending}>
              {isResending ? (
                 <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                 <Text style={[styles.resendLink, timeLeft > 0 && styles.resendLinkDisabled]}>
                   {timeLeft > 0 ? `Resend in ${timeLeft}s` : 'Resend'}
                 </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  headerTitles: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
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
  otpInputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  otpTextInput: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    color: Colors.text,
    textAlign: 'center',
    width: '100%',
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
  btnDisabled: { 
    backgroundColor: Colors.surfaceSecondary || '#E5E7EB',
  },
  btnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  resendText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  resendLink: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: Colors.muted,
  },
});
