import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { Feather } from '@expo/vector-icons';
import { updateProfile, changePassword } from '../api/profile.api';

export default function ProfileScreen({ navigation }) {
  const { user, updateUserContext, logout } = useAuth();
  
  // Name Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Password Edit State
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setIsSavingName(true);
    try {
      await updateProfile({ name: nameInput.trim() });
      await updateUserContext({ name: nameInput.trim() });
      setIsEditingName(false);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    setIsSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(
        'Password Changed',
        'Your password was changed successfully. Please log in again.',
        [{ text: 'OK', onPress: () => logout() }]
      );
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to update password');
      setIsSavingPassword(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Name Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Name</Text>
            {!isEditingName ? (
              <TouchableOpacity onPress={() => { setIsEditingName(true); setNameInput(user?.name || ''); }}>
                <Feather name="edit-2" size={18} color={Colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setIsEditingName(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {!isEditingName ? (
            <Text style={styles.cardValue}>{user?.name}</Text>
          ) : (
            <View>
              <TextInput
                style={styles.textInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                placeholder="Enter your name"
              />
              <TouchableOpacity 
                style={[styles.saveBtn, isSavingName && styles.saveBtnDisabled]}
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>Save Name</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Email Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Email</Text>
            <Feather name="lock" size={16} color={Colors.muted} />
          </View>
          <Text style={styles.cardValue}>{user?.email}</Text>
        </View>

        {/* Password Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Password</Text>
            {!isEditingPassword ? (
              <TouchableOpacity onPress={() => { setIsEditingPassword(true); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }}>
                <Feather name="edit-2" size={18} color={Colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setIsEditingPassword(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {!isEditingPassword ? (
            <Text style={styles.cardValue}>••••••••</Text>
          ) : (
            <View>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.textInput}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
              />

              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.textInput}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.textInput}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
              />

              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              <TouchableOpacity 
                style={[styles.saveBtn, isSavingPassword && styles.saveBtnDisabled]}
                onPress={handleSavePassword}
                disabled={isSavingPassword}
              >
                {isSavingPassword ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>Save Password</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  headerIconBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRightPlaceholder: {
    width: 32, // matches back button size to center title
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: Typography.size.md,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 4,
  },
  editBtnText: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: '600',
  },
  cancelBtnText: {
    color: Colors.muted,
    fontSize: Typography.size.sm,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.size.md,
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: '#FAFAFA',
  },
  inputLabel: {
    fontSize: Typography.size.sm,
    color: Colors.text,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#50178E',
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontWeight: '700',
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.md,
  },
});
