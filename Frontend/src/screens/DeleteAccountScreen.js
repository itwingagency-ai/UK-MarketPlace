import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { requestAccountDeletionCode, deleteAccount } from '../api/app.api';
import { useAuth } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import Button from '../components/Button';
import { ScreenHeader, Card, sharedStyles } from '../components/vendor/VendorUI';
import { Colors, Radius, Spacing, Typography } from '../theme';

/**
 * Close the account: we email a 6-digit code, the customer types it in.
 * What happens is spelled out before anything is deleted.
 */
export default function DeleteAccountScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { showAlert } = useCustomAlert();
  const [step, setStep] = useState('explain');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (err) =>
    showAlert({ title: "Couldn't do that", message: err.response?.data?.message || 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });

  const sendCode = async () => {
    setBusy(true);
    try {
      await requestAccountDeletionCode();
      setStep('code');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    showAlert({
      title: 'Delete your account?',
      message: "This can't be undone. Your points and saved details will be gone.",
      isDestructive: true,
      confirmText: 'Delete for good',
      cancelText: 'Keep my account',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteAccount(code.trim());
          await logout();
        } catch (err) {
          fail(err);
          setBusy(false);
        }
      },
    });

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Delete account" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[sharedStyles.content, { gap: Spacing.base }]}>
        <Card style={{ gap: Spacing.sm }}>
          <Text style={styles.title}>What happens</Text>
          {[
            'Your name, email, phone number and saved addresses are removed.',
            'Your basket, saved cards link, favourites and notifications are deleted.',
            'Any rewards points are lost.',
            'Past orders are kept for the shops\' and our accounting, without your name or address.',
            'You can sign up again later with the same email.',
          ].map((line) => (
            <View key={line} style={styles.row}>
              <Feather name="check" size={16} color={Colors.textSecondary} />
              <Text style={styles.body}>{line}</Text>
            </View>
          ))}
        </Card>

        {step === 'explain' ? (
          <Button title={`Email a code to ${user?.email || 'me'}`} onPress={sendCode} loading={busy} variant="danger" size="full" />
        ) : (
          <Card style={{ gap: Spacing.md }}>
            <Text style={styles.body}>Enter the 6-digit code we emailed you. It lasts 10 minutes.</Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={Colors.muted}
              style={styles.code}
              accessibilityLabel="Deletion code"
            />
            <Button title="Delete my account" onPress={confirm} loading={busy} disabled={code.length !== 6} variant="danger" size="full" />
            <Button title="Send a new code" onPress={sendCode} variant="ghost" size="full" disabled={busy} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Typography.family.display, fontSize: 16, color: Colors.text },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  body: { flex: 1, fontFamily: Typography.family.regular, fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  code: {
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    fontFamily: Typography.family.displayExtrabold,
    fontSize: 26,
    letterSpacing: 8,
    color: Colors.text,
  },
});
