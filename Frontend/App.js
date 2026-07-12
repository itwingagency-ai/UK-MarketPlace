import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider, useCart } from './src/context/CartContext';

import { FavoritesProvider } from './src/context/FavoritesContext';
import { LocationProvider } from './src/context/LocationContext';
import { AlertProvider } from './src/context/AlertContext';

import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OtpVerificationScreen from './src/screens/OtpVerificationScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ShopHomeScreen from './src/screens/ShopHomeScreen';
import StoreCategoriesScreen from './src/screens/StoreCategoriesScreen';
import StoreProductsScreen from './src/screens/StoreProductsScreen';
import StoreInfoScreen from './src/screens/StoreInfoScreen';
import BasketScreen from './src/screens/BasketScreen';
import AccountScreen from './src/screens/AccountScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FavouritesScreen from './src/screens/FavouritesScreen';
import MoreScreen from './src/screens/MoreScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import BottomTabBar from './src/components/BottomTabBar';

import { Colors } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Bottom Tab Navigator — the main app interface after postcode entry.
 * Contains: Home (store list), Basket, Account, More.
 */
function MainTabs() {
  const { itemCount } = useCart();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <BottomTabBar {...props} cartItemCount={itemCount} />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="ShopHomeTab" component={ShopHomeStack} />
      <Tab.Screen name="BasketTab" component={BasketScreen} />
      <Tab.Screen name="AccountTab" component={AccountStack} />
      <Tab.Screen name="MoreTab" component={MoreScreen} />
    </Tab.Navigator>
  );
}

/**
 * ShopHome stack — nested inside the Home tab.
 * Allows drill-down: ShopHome → StoreCategories → StoreProducts → StoreInfo
 */
function ShopHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ShopHome" component={ShopHomeScreen} />
      <Stack.Screen name="StoreCategories" component={StoreCategoriesScreen} />
      <Stack.Screen name="StoreProducts" component={StoreProductsScreen} />
      <Stack.Screen name="StoreInfo" component={StoreInfoScreen} />
    </Stack.Navigator>
  );
}

/**
 * Account stack — nested inside the Account tab.
 * Allows navigation to Login/Register screens.
 */
function AccountStack() {
  const { isAuthenticated } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Favourites" component={FavouritesScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

/**
 * Root stack — HomeScreen (postcode entry) is the entry point.
 * After postcode search, user navigates to MainTabs.
 */
function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

/**
 * Root navigator — switches based on auth state.
 */
function RootNavigator() {
  const { isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AlertProvider>
          <LocationProvider>
            <AuthProvider>
              <FavoritesProvider>
                <CartProvider>
                  <StatusBar style="auto" />
                  <RootNavigator />
                </CartProvider>
              </FavoritesProvider>
            </AuthProvider>
          </LocationProvider>
        </AlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});
