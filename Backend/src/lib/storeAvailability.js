/**
 * "Busy mode": a shopkeeper can pause new orders for a while without touching
 * their opening hours. A paused store reports itself as closed everywhere a
 * customer looks, and checkout refuses its items until the pause ends.
 */

const MAX_PAUSE_MINUTES = 8 * 60;

const isOrdersPaused = (store, now = new Date()) =>
  Boolean(store?.ordersPausedUntil) && new Date(store.ordersPausedUntil) > now;

const formatClock = (date, timezone) => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "Europe/London",
    }).format(new Date(date));
  } catch (_err) {
    return new Date(date).toISOString().slice(11, 16);
  }
};

/**
 * Layer the pause on top of an open/closed status from computeOpenStatus().
 */
const applyBusyStatus = (status, store) => {
  if (!isOrdersPaused(store)) {
    return { ...status, isBusy: false, busyUntil: null };
  }
  const until = formatClock(store.ordersPausedUntil, store.timezone);
  return {
    ...status,
    isOpen: false,
    isBusy: true,
    busyUntil: store.ordersPausedUntil,
    statusLabel: `Busy — taking orders again at ${until}`,
  };
};

module.exports = {
  MAX_PAUSE_MINUTES,
  applyBusyStatus,
  formatClock,
  isOrdersPaused,
};
