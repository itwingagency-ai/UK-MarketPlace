import { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../api/client';

/**
 * One Socket.IO connection for the vendor / admin portal.
 *
 * The server puts vendors in their store's room and admins in the admin feed
 * (Backend/src/lib/socketIO.js). Here we:
 *   - toast new orders and "customer is outside" arrivals,
 *   - let pages subscribe with useLiveOrders() to refresh themselves.
 * The token is read on every (re)connect, so a refreshed login just works.
 */
const LiveOrdersContext = createContext(null);
const EVENTS = ['order:created', 'order:status_changed', 'order:payment_updated', 'order:customer_arrived'];

export function LiveOrdersProvider({ role, children }) {
  const listeners = useRef(new Set());

  useEffect(() => {
    const socket = io(API_BASE_URL, {
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') || '' }),
      transports: ['websocket', 'polling'],
    });

    const handlers = EVENTS.map((event) => {
      const handler = (payload) => {
        if (event === 'order:created' && role === 'vendor') {
          toast.success(`New order #${payload?.orderNumber || ''}`, { id: `new-${payload?.orderId}` });
        }
        if (event === 'order:customer_arrived') {
          toast(
            `Customer outside to collect #${payload?.orderNumber || ''}${payload?.note ? ` — ${payload.note}` : ''}`,
            { id: `arrived-${payload?.orderId}`, icon: '🚗', duration: 20000 }
          );
        }
        for (const fn of listeners.current) fn(event, payload);
      };
      socket.on(event, handler);
      return [event, handler];
    });

    return () => {
      handlers.forEach(([event, handler]) => socket.off(event, handler));
      socket.disconnect();
    };
  }, [role]);

  return <LiveOrdersContext.Provider value={listeners}>{children}</LiveOrdersContext.Provider>;
}

/** Call `onEvent(eventName, payload)` for every live order event while mounted. */
export function useLiveOrders(onEvent) {
  const listeners = useContext(LiveOrdersContext);
  const latest = useRef(onEvent);
  latest.current = onEvent;
  useEffect(() => {
    if (!listeners) return undefined;
    const set = listeners.current;
    const fn = (event, payload) => latest.current?.(event, payload);
    set.add(fn);
    return () => set.delete(fn);
  }, [listeners]);
}
