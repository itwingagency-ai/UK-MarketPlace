import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';

export default function OrderSuccessScreen({ route, navigation }) {
  const orders = route.params?.orders || [];
  useEffect(() => {
    const backAction = () => {
      // Prevent back button
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const handleContinueShopping = () => {
    navigation.navigate('MainTabs', { screen: 'ShopHomeTab' });
  };

  const handleViewOrders = () => {
    navigation.navigate('MainTabs', { 
      screen: 'AccountTab', 
      params: { screen: 'Orders' } 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather name="check-circle" size={80} color={Colors.success} />
        </View>
        <Text style={styles.title}>Order Placed Successfully!</Text>
        <Text style={styles.message}>
          Thank you for your purchase. Your order has been received and is being processed.
        </Text>

        {orders && orders.length > 0 && (
          <View style={styles.contactContainer}>
            <Text style={styles.contactTitle}>Store Contact Details</Text>
            {orders.map((order, idx) => (
              <View key={order.id || idx} style={styles.contactRow}>
                <Text style={styles.contactStore}>{order.storeName}:</Text>
                <Text style={styles.contactPhone}>{order.storeContact || 'Not provided'}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handleContinueShopping}
        >
          <Text style={styles.buttonText}>Continue Shopping</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.outlineButton]}
          onPress={handleViewOrders}
        >
          <Text style={[styles.buttonText, styles.outlineButtonText]}>View Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  message: {
    ...Typography.body1,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  buttonText: {
    ...Typography.subtitle1,
    color: Colors.white,
    fontWeight: '600',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  outlineButtonText: {
    color: Colors.primary,
  },
  contactContainer: {
    width: '100%',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  contactTitle: {
    ...Typography.subtitle1,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  contactStore: {
    ...Typography.body2,
    fontWeight: '500',
    color: Colors.text,
    marginRight: Spacing.xs,
  },
  contactPhone: {
    ...Typography.body2,
    color: Colors.primary,
  },
});
