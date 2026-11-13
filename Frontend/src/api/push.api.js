import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './client';

export const PUSH_TOKEN_KEY = 'ukm_push_token';

export const registerPushToken = async (token, platform) => {
  await client.post('/me/push-tokens', { token, platform });
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
};

/** Called on logout so this phone stops receiving the account's alerts. */
export const unregisterPushToken = async () => {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) await client.delete('/me/push-tokens', { data: { token } });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // best effort
  }
};
