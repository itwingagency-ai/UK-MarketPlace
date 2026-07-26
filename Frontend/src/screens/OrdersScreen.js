import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { getMyOrders } from '../api/orders.api';

export default function OrdersScreen({ navigation, route }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (route.params?.autoOpenOrderId) {
      const orderId = route.params.autoOpenOrderId;
      navigation.setParams({ autoOpenOrderId: undefined });
      navigation.navigate('OrderDetail', { orderId });
    }
  }, [route.params?.autoOpenOrderId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyOrders();
      setOrders(data.orders || data.data || []);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const amount = (item.total / 100).toFixed(2);
    const date = new Date(item.createdAt).toLocaleDateString();
    const statusStr = item.orderStatus || 'pending';
    
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('OrderDetail', { orderId: item._id })}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #{item.orderNumber || item._id.slice(-6).toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStr === 'delivered' ? '#E8F5E9' : '#FFF3E0' }]}>
            <Text style={[styles.statusText, { color: statusStr === 'delivered' ? '#2E7D32' : '#F57C00' }]}>
              {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.storeName}>{item.store?.name || 'Store'}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.date}>{date}</Text>
          <Text style={styles.total}>£{amount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchOrders} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={64} color={Colors.muted} />
          <Text style={styles.emptyText}>You haven't placed any orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  errorText: { fontSize: Typography.size.base, color: Colors.text, marginBottom: Spacing.md },
  retryBtn: { padding: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  retryBtnText: { color: Colors.white, fontWeight: '600' },
  emptyText: { marginTop: Spacing.lg, fontSize: Typography.size.base, color: Colors.textSecondary },
  listContent: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  orderId: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: Typography.size.xs, fontWeight: '700' },
  storeName: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  total: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.primary },
});
