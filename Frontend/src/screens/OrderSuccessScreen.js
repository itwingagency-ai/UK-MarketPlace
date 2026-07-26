import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';

export default function OrderSuccessScreen({ route, navigation }) {
  const orders = route.params?.orders || [];
  useEffect(() => {
    const backAction = () => {
      // Exit app instead of returning to checkout/previous screens
      BackHandler.exitApp();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const handleContinueShopping = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              index: 0,
              routes: [
                { name: 'ShopHomeTab' },
                { name: 'BasketTab' },
                { name: 'AccountTab' },
                // { name: 'MoreTab' },
              ],
            },
          },
        ],
      })
    );
  };

  const handleViewOrders = () => {
    const orderId = orders?.[0]?._id || orders?.[0]?.id;
    if (orderId) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs',
              state: {
                index: 2,
                routes: [
                  { name: 'ShopHomeTab' },
                  { name: 'BasketTab' },
                  {
                    name: 'AccountTab',
                    state: {
                      index: 1,
                      routes: [
                        { name: 'Account' },
                        { name: 'OrderDetail', params: { orderId } },
                      ],
                    },
                  },
                  // { name: 'MoreTab' },
                ],
              },
            },
          ],
        })
      );
    } else {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs',
              state: {
                index: 2,
                routes: [
                  { name: 'ShopHomeTab' },
                  { name: 'BasketTab' },
                  {
                    name: 'AccountTab',
                    state: {
                      index: 0,
                      routes: [{ name: 'Account' }],
                    },
                  },
                  // { name: 'MoreTab' },
                ],
              },
            },
          ],
        })
      );
    }
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
            <Text style={styles.contactTitle}>
              Order Breakdown ({orders.length} {orders.length === 1 ? 'Order' : 'Orders'} Placed)
            </Text>
            {orders.map((order, idx) => (
              <View key={order.id || idx} style={[styles.contactRow, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: idx < orders.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <Text style={[styles.contactStore, { fontWeight: '700' }]}>{order.storeName}</Text>
                  {order.total != null && (
                    <Text style={{ fontWeight: '700', color: Colors.primary }}>£{(Number(order.total) / 100).toFixed(2)}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Order #{order.orderNumber || (typeof order.id === 'string' ? order.id.slice(-6).toUpperCase() : '')} • Contact: {order.storeContact || 'Not provided'}
                </Text>
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
          <Text style={[styles.buttonText, styles.outlineButtonText]}>View Order</Text>
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
