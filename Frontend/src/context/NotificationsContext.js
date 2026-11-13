import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { io } from 'socket.io-client';
import { registerPushToken } from '../api/push.api';
import { API_BASE_URL, STORAGE_KEYS } from '../constants';
import { useAuth } from './AuthContext';
import { navigateWhenReady } from '../navigation/navigationRef';

/**
 * Live alerts for shopkeepers and customers.
 *
 * - A Socket.IO connection (same server as the API) delivers "app:notification"
 *   events, shown as a local banner, plus order/stock events screens can
 *   subscribe to for live refreshes.
 * - If the device can get an Expo push token (needs Firebase on Android), it
 *   is registered so alerts also arrive while the app is closed. Then the
 *   socket only shows banners while the app is open, to avoid duplicates.
 */

const SOCKET_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // While the app is open, banners come from the socket; hide the duplicate push
    const isRemote = notification.request.trigger?.type === 'push';
    return {
      shouldShowBanner: !isRemote,
      shouldShowList: true,
      shouldPlaySound: !isRemote,
      shouldSetBadge: false,
    };
  },
});

const NotificationsContext = createContext({ subscribe: () => () => {} });

async function setUpChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Orders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#50178E',
  });
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Returns an Expo push token, or null when push isn't available on this build. */
async function getPushToken() {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    // Typically: Firebase (google-services.json) not configured for Android
    return null;
  }
}

function openFromNotification(data, role) {
  if (!data?.type) return;
  if (data.type === 'order:new' && role === 'vendor') {
    navigateWhenReady('VendorOrderDetail', { orderId: data.orderId });
  } else if (data.type === 'order:status' && role !== 'vendor') {
    navigateWhenReady('MainTabs', {
      screen: 'AccountTab',
      params: { screen: 'OrderDetail', params: { orderId: data.orderId }, initial: false },
    });
  } else if (data.type === 'stock:back' && role !== 'vendor') {
    navigateWhenReady('ProductDetail', { product: { _id: data.productId } });
  }
}

export function NotificationsProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const listeners = useRef(new Map());
  const pushEnabled = useRef(false);
  const role = user?.role;

  const emit = useCallback((name, payload) => {
    (listeners.current.get(name) || []).forEach((fn) => fn(payload));
  }, []);

  /** Screens call subscribe('order:created', fn) and get back an unsubscribe. */
  const subscribe = useCallback((name, fn) => {
    const list = listeners.current.get(name) || [];
    listeners.current.set(name, [...list, fn]);
    return () => {
      listeners.current.set(name, (listeners.current.get(name) || []).filter((f) => f !== fn));
    };
  }, []);

  // Permissions, channels and push token, once per signed-in session
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      await setUpChannels();
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted' || cancelled) return;
      const token = await getPushToken();
      if (!token || cancelled) return;
      try {
        await registerPushToken(token, Platform.OS);
        pushEnabled.current = true;
      } catch {
        pushEnabled.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  // Live connection
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      // Read the token on every (re)connect so refreshed tokens are used
      auth: (cb) => {
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN).then((t) => cb({ token: t ? `Bearer ${t}` : '' }));
      },
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });

    socket.on('app:notification', (n) => {
      emit('app:notification', n);
      // With push available the OS shows it when the app is in the background
      if (pushEnabled.current && AppState.currentState !== 'active') return;
      Notifications.scheduleNotificationAsync({
        content: { title: n.title, body: n.body, data: n.data || {}, sound: true },
        trigger: Platform.OS === 'android' ? { channelId: n.channelId || 'default' } : null,
      }).catch(() => {});
    });
    ['order:created', 'order:status_changed'].forEach((name) => socket.on(name, (p) => emit(name, p)));

    // A rejected login (e.g. expired token) is not retried automatically.
    // Try again shortly; by then the API client will usually have refreshed it.
    let retry = null;
    socket.on('connect_error', () => {
      clearTimeout(retry);
      retry = setTimeout(() => { if (!socket.connected) socket.connect(); }, 10000);
    });

    return () => {
      clearTimeout(retry);
      socket.disconnect();
    };
  }, [isAuthenticated, user?.id, emit]);

  // Tapping a notification opens the matching screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(response.notification.request.content.data, role);
    });
    return () => sub.remove();
  }, [role]);

  return <NotificationsContext.Provider value={{ subscribe }}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);

/** Re-run `fn` whenever one of the named live events arrives. */
export function useLiveEvent(names, fn) {
  const { subscribe } = useNotifications();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const list = Array.isArray(names) ? names : [names];
    const offs = list.map((name) => subscribe(name, (p) => ref.current(p)));
    return () => offs.forEach((off) => off());
  }, [subscribe, Array.isArray(names) ? names.join('|') : names]); // eslint-disable-line react-hooks/exhaustive-deps
}
