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
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const isFormValid = email.trim().length > 0 && /\S+@\S+\.\S+/.test(email);

  const handleSendLink = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsSubmitting(true);
    const result = await forgotPassword(email.trim().toLowerCase());
    setIsSubmitting(false);

    if (result.success) {
      navigation.navigate('OtpVerification', { email: email.trim().toLowerCase(), mode: 'forgot_password' });
    } else {
      setError(result.error || 'Failed to send OTP. Try again.');
    }
  };

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
            <Text style={styles.headerTitle}>Forgot Password?</Text>
            <Text style={styles.headerSubtitle}>Password Recovery</Text>
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
              Enter the email address associated with your account and we'll send you a code to reset your password.
            </Text>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Email</Text>
            <View style={[
              styles.inputContainer,
              isFocused ? styles.inputContainerFocused : null,
              error ? styles.inputContainerError : null,
            ]}>
              <Feather name="mail" size={20} color={isFocused ? Colors.primary : Colors.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="youremail@example.com"
                placeholderTextColor={Colors.muted}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.btn, (!isFormValid || isSubmitting) && styles.btnDisabled]}
            onPress={handleSendLink}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.btnText}>Send Reset Code</Text>
            )}
          </TouchableOpacity>
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
  inputContainerFocused: {
    borderColor: Colors.primary,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  inputIcon: {
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
  btnDisabled: { 
    backgroundColor: Colors.surfaceSecondary || '#E5E7EB',
  },
  btnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
  },
});
