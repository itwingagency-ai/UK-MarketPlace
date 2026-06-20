import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import { Colors, Spacing, Typography, Radius } from '../theme';

const { height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const { register, isLoading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validateForm = () => {
    let valid = true;
    setNameError(''); setEmailError(''); setPasswordError('');
    if (!name.trim()) { setNameError('Full name is required'); valid = false; }
    if (!email.trim()) { setEmailError('Email is required'); valid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Please enter a valid email'); valid = false; }
    if (!password) { setPasswordError('Password is required'); valid = false; }
    else if (password.length < 8) { setPasswordError('Password must be at least 8 characters'); valid = false; }
    return valid;
  };

  const handleRegister = async () => {
    if (!validateForm()) { shake(); return; }
    setIsSubmitting(true);
    const result = await register(name.trim(), email.trim().toLowerCase(), password);
    setIsSubmitting(false);
    if (!result.success) {
      setEmailError(result.error ?? 'Registration failed. Please try again.');
      shake();
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
          activeOpacity={0.8}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.content, { transform: [{ translateX: shakeAnim }] }]}>
            <View style={styles.headerBlock}>
              <Text style={styles.welcomeLabel}>Get started</Text>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.tagline}>Sign up for Snappy Shopper today.</Text>
            </View>

            <Input
              label="Full Name"
              placeholder="Your full name"
              value={name}
              onChangeText={(t) => { setName(t); setNameError(''); }}
              autoCapitalize="words"
              leftIcon={<Text style={styles.inputIcon}>👤</Text>}
              error={nameError}
            />
            <Input
              label="Email"
              placeholder="youremail@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Text style={styles.inputIcon}>✉️</Text>}
              error={emailError}
            />
            <Input
              label="Password"
              placeholder="Create a password (8+ characters)"
              value={password}
              onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<Text style={styles.inputIcon}>🔒</Text>}
              error={passwordError}
            />

            <TouchableOpacity
              style={[styles.registerBtn, isLoading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.registerBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  flex: { flex: 1 },
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
  backIcon: { fontSize: 20, color: Colors.text, fontWeight: '600', lineHeight: 22 },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing['3xl'] },
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
  },
  inputIcon: { fontSize: 16 },
  registerBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.7 },
  registerBtnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPrompt: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
});
