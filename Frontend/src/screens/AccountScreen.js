import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius } from '../theme';

export default function AccountScreen({ navigation }) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
        </View>
      </SafeAreaView>
      <View style={styles.content}>
        {isAuthenticated ? (
          <>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <View style={styles.personHead} />
                <View style={styles.personBody} />
              </View>
            </View>
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.subtitle}>{user?.email || 'Signed in'}</Text>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={logout}
              activeOpacity={0.85}
            >
              <Text style={styles.logoutBtnText}>Log out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <View style={styles.personHead} />
                <View style={styles.personBody} />
              </View>
            </View>
            <Text style={styles.title}>Sign in to your account</Text>
            <Text style={styles.subtitle}>
              Access your orders, saved addresses, and more
            </Text>
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerBtnText}>Create account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.base,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['3xl'],
    paddingBottom: 100,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: '#BFDBFE',
  },
  avatar: {
    alignItems: 'center',
  },
  personHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginBottom: 3,
  },
  personBody: {
    width: 28,
    height: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  signInBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  signInBtnText: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.white,
  },
  registerBtn: {
    paddingVertical: Spacing.sm,
  },
  registerBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutBtnText: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },
});
