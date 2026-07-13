import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { Feather } from '@expo/vector-icons';
import { getMyOrderById } from '../api/orders.api';

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyOrderById(orderId);
      setOrder(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const imageUrl =
      item.product?.images?.[0] ||
      'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';

    return (
      <View style={styles.itemRow}>
        <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.product?.title || 'Unknown Product'}
          </Text>
          <View style={styles.itemPriceRow}>
            <Text style={styles.itemQty}>
              Qty: {item.quantity}  •  £{((item.unitPrice || item.price || 0) / 100).toFixed(2)} each
            </Text>
            <Text style={styles.itemPrice}>
              £{(((item.unitPrice || item.price || 0) * item.quantity) / 100).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Order not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchOrder}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.retryBtn, { marginTop: 10, backgroundColor: Colors.border }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.retryBtnText, { color: Colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusStr = order.orderStatus || 'pending';
  const statusColors = {
    pending: { bg: '#FFF3E0', text: '#F57C00' },
    confirmed: { bg: '#E3F2FD', text: '#1976D2' },
    packed: { bg: '#E1BEE7', text: '#8E24AA' },
    shipped: { bg: '#E8EAF6', text: '#3F51B5' },
    delivered: { bg: '#E8F5E9', text: '#2E7D32' },
    cancelled: { bg: '#FFEBEE', text: '#D32F2F' },
  };
  const colorSet = statusColors[statusStr] || statusColors.pending;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Detail</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <FlatList
        data={order.items}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.orderNumber}>
                Order #{order.orderNumber || order._id.slice(-6).toUpperCase()}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: colorSet.bg }]}>
                <Text style={[styles.statusText, { color: colorSet.text }]}>
                  {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Store</Text>
              <Text style={styles.summaryValue}>{order.store?.name || 'Store'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>
                {new Date(order.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items Subtotal</Text>
              <Text style={styles.summaryValue}>£{(order.subtotal / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>£{(order.shippingFee / 100).toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{(order.total / 100).toFixed(2)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  retryBtnText: {
    ...Typography.subtitle,
    color: Colors.surface,
  },
  listContent: {
    padding: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderNumber: {
    ...Typography.h4,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body,
    color: Colors.muted,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    ...Typography.subtitle,
    fontSize: 16,
  },
  totalValue: {
    ...Typography.subtitle,
    fontSize: 18,
    color: Colors.primary,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    marginRight: Spacing.md,
    backgroundColor: Colors.border,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  itemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQty: {
    ...Typography.caption,
    color: Colors.muted,
  },
  itemPrice: {
    ...Typography.subtitle,
    color: Colors.primary,
  },
});
