import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside screens (e.g. tapping a notification) navigate.
export const navigationRef = createNavigationContainerRef();

export function navigateWhenReady(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return;
  }
  // The app may still be starting up after a tap on a notification
  setTimeout(() => navigateWhenReady(name, params), 300);
}
