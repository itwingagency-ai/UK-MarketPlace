import React, { useState, useEffect } from 'react';
import {
  Linking,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { Feather } from '@expo/vector-icons';
import { getMyOrderById, reorder, cancelMyOrder, markArrived } from '../api/orders.api';
import { useCart } from '../context/CartContext';
import { useLiveEvent } from '../context/NotificationsContext';
import Button from '../components/Button';
import PriceLines from '../components/PriceLines';
import { getMyReviews, submitReview, updateMyReview } from '../api/reviews.api';
import { useCustomAlert } from '../context/AlertContext';

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const { showAlert } = useCustomAlert() || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [myReviews, setMyReviews] = useState([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedItemForReview, setSelectedItemForReview] = useState(null);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const { fetchCart } = useCart();
  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [arriving, setArriving] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // The shop accepting / sending the order updates this screen live
  useLiveEvent('order:status_changed', (p) => {
    if (p?.orderId === orderId) fetchOrder({ silent: true });
  });

  // The rider's last shared position while the order is out for delivery
  const [riderAt, setRiderAt] = useState(null);
  useLiveEvent('order:rider_location', (p) => {
    if (p?.orderId === String(orderId)) setRiderAt({ lat: p.lat, lng: p.lng, at: p.at });
  });

  const handleReorder = async () => {
    setReordering(true);
    try {
      const res = await reorder(orderId);
      await fetchCart();
      const { added, skipped } = res.data;
      const skippedText = skipped.length
        ? `\n\nNot added: ${skipped.map((s) => `${s.title} (${s.reason.toLowerCase()})`).join(', ')}`
        : '';
      if (added.length === 0) {
        showAlert({ title: "Couldn't add these items", message: `None of these items can be ordered right now.${skippedText}`, icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
        return;
      }
      showAlert({
        title: 'Added to your basket',
        message: `${added.length} item${added.length === 1 ? '' : 's'} added at today's prices.${skippedText}`,
        icon: 'shopping-bag',
        confirmText: 'View basket',
        cancelText: 'Stay here',
        onConfirm: () => navigation.navigate('BasketTab'),
      });
    } catch (err) {
      showAlert({ title: "Couldn't reorder", message: err.response?.data?.message || 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setReordering(false);
    }
  };

  const handleCancel = () => {
    showAlert({
      title: 'Cancel this order?',
      message: order?.paymentStatus === 'paid'
        ? 'The store hasn\'t accepted it yet. Your card payment will be refunded.'
        : 'The store hasn\'t accepted it yet, so you can still cancel.',
      icon: 'x-circle',
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
      onConfirm: async () => {
        setCancelling(true);
        try {
          const res = await cancelMyOrder(orderId);
          await fetchOrder({ silent: true });
          showAlert({ title: 'Order cancelled', message: res.message, icon: 'check-circle', showCancel: false, confirmText: 'OK' });
        } catch (err) {
          await fetchOrder({ silent: true });
          showAlert({ title: "Couldn't cancel", message: err.response?.data?.message || 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  const handleArrived = async () => {
    setArriving(true);
    try {
      const res = await markArrived(orderId);
      await fetchOrder({ silent: true });
      showAlert({ title: 'The store knows you\'re here', message: res.message || 'Someone will bring your order out.', icon: 'check-circle', showCancel: false, confirmText: 'OK' });
    } catch (err) {
      showAlert({ title: "Couldn't let the store know", message: err.response?.data?.message || 'Please try again.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setArriving(false);
    }
  };

  const fetchOrder = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await getMyOrderById(orderId);
      setOrder(res.data);
      const statusStr = (res.data?.orderStatus || '').toLowerCase();
      if (['shipped', 'delivered', 'collected', 'completed'].includes(statusStr)) {
        try {
          const revRes = await getMyReviews({ limit: 100 });
          setMyReviews(revRes.data || []);
        } catch (rErr) {
          console.log('Could not load reviews:', rErr);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyReviews = async () => {
    try {
      const revRes = await getMyReviews({ limit: 100 });
      setMyReviews(revRes.data || []);
    } catch (rErr) {
      console.log('Could not load reviews:', rErr);
    }
  };

  const openReviewModal = (item, existingReview = null) => {
    setSelectedItemForReview(item);
    if (existingReview) {
      setEditingReviewId(existingReview._id);
      setRating(existingReview.rating || 5);
      setReviewTitle(existingReview.title || '');
      setReviewBody(existingReview.body || '');
    } else {
      setEditingReviewId(null);
      setRating(5);
      setReviewTitle('');
      setReviewBody('');
    }
    setReviewModalVisible(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewBody.trim()) {
      if (showAlert) {
        showAlert({ title: 'Required', message: 'Please enter your review comment.', showCancel: false, confirmText: 'OK' });
      } else {
        alert('Please enter your review comment.');
      }
      return;
    }
    const productId = selectedItemForReview?.product?._id || selectedItemForReview?.product;
    if (!productId) {
      if (showAlert) {
        showAlert({ title: 'Error', message: 'Product ID not found.', showCancel: false, confirmText: 'OK' });
      }
      return;
    }
    try {
      setSubmittingReview(true);
      const payload = {
        rating: Number(rating),
        title: reviewTitle.trim(),
        body: reviewBody.trim(),
      };
      if (editingReviewId) {
        await updateMyReview(editingReviewId, payload);
      } else {
        await submitReview(productId, payload);
      }
      setReviewModalVisible(false);
      if (showAlert) {
        showAlert({ title: 'Success', message: 'Thank you! Your review has been submitted.', showCancel: false, confirmText: 'OK' });
      } else {
        alert('Thank you! Your review has been submitted.');
      }
      fetchMyReviews();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit review';
      if (showAlert) {
        showAlert({ title: 'Error', message: msg, showCancel: false, confirmText: 'OK' });
      } else {
        alert(msg);
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderItem = ({ item }) => {
    const imageUrl =
      item.product?.images?.[0] ||
      'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';

    const productId = item.product?._id || item.product;
    const existingReview = myReviews.find(r => {
      const rProdId = r.product?._id || r.product;
      return rProdId && productId && rProdId.toString() === productId.toString();
    });

    const isOrderCompleted = order && 
      ['delivered', 'collected', 'completed'].includes((order.orderStatus || '').toLowerCase()) && 
      (order.paymentStatus || '').toLowerCase() === 'paid';

    return (
      <View style={styles.itemContainerCard}>
        <View style={styles.itemRowInner}>
          <Image source={{ uri: imageUrl }} style={styles.itemImage} />
          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.product?.title || 'Unknown Product'}
            </Text>
            <View style={styles.itemPriceRow}>
              <Text style={styles.itemQty}>
                Qty: {item.quantity}  •  £{((item.unitPrice || item.price || 0) / 100).toFixed(2)} each
              </Text>
              <Text style={[styles.itemPrice, ['unavailable', 'refused'].includes(item.lineStatus) && { textDecorationLine: 'line-through', color: Colors.muted }]}>
                £{(((item.unitPrice || item.price || 0) * item.quantity) / 100).toFixed(2)}
              </Text>
            </View>
            {item.lineStatus === 'unavailable' ? (
              <Text style={[styles.itemQty, { color: Colors.errorText }]}>The store couldn't supply this. Not charged.</Text>
            ) : item.lineStatus === 'refused' ? (
              <Text style={[styles.itemQty, { color: Colors.errorText }]}>Not handed over without ID. Not charged.</Text>
            ) : item.lineStatus === 'substituted' ? (
              <Text style={[styles.itemQty, { color: Colors.warningText }]}>Swapped for {item.substitutedFor} (never at a higher price)</Text>
            ) : item.originalQuantity && item.originalQuantity > item.quantity ? (
              <Text style={[styles.itemQty, { color: Colors.warningText }]}>Only {item.quantity} of {item.originalQuantity} available</Text>
            ) : null}
          </View>
        </View>

        {isOrderCompleted && (
          <View style={styles.reviewSection}>
            {existingReview ? (
              <View style={styles.existingReviewBox}>
                <View style={styles.existingReviewHeader}>
                  <View style={styles.starsDisplay}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Text key={s} style={[styles.starIconText, { color: s <= existingReview.rating ? '#FFB800' : Colors.border }]}>
                        ★
                      </Text>
                    ))}
                    <Text style={styles.existingRatingValue}>{existingReview.rating}.0</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editReviewBtn}
                    onPress={() => openReviewModal(item, existingReview)}
                  >
                    <Feather name="edit-2" size={13} color={Colors.primary} />
                    <Text style={styles.editReviewText}>Edit</Text>
                  </TouchableOpacity>
                </View>
                {existingReview.title ? (
                  <Text style={styles.existingReviewTitle} numberOfLines={1}>{existingReview.title}</Text>
                ) : null}
                {existingReview.body ? (
                  <Text style={styles.existingReviewBody} numberOfLines={2}>{existingReview.body}</Text>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={() => openReviewModal(item, null)}
                activeOpacity={0.8}
              >
                <View style={styles.rateBtnLeft}>
                  <View style={styles.starBadge}>
                    <Text style={styles.starBadgeText}>★</Text>
                  </View>
                  <View>
                    <Text style={styles.rateBtnTitle}>Rate & Review Product</Text>
                    <Text style={styles.rateBtnSubtitle}>Share your experience with others</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
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
    ready_for_collection: { bg: '#EDE0FD', text: '#6920C2' },
    collected: { bg: '#E8F5E9', text: '#2E7D32' },
    cancelled: { bg: '#FFEBEE', text: '#D32F2F' },
  };
  const STATUS_LABELS = { ready_for_collection: 'Ready to collect', shipped: 'Out for delivery' };
  const collecting = order.fulfilment?.method === 'collection';
  // Live tracking: straight-line distance to the door, at about 20 km/h
  const here = riderAt || (order.delivery?.lastLocation?.lat != null ? order.delivery.lastLocation : null);
  const dest = order.shippingAddress?.lat != null ? order.shippingAddress : null;
  const distanceKm = here && dest ? (() => {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(dest.lat - here.lat);
    const dLng = toRad(dest.lng - here.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(here.lat)) * Math.cos(toRad(dest.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  })() : null;
  const etaMins = distanceKm != null ? Math.max(1, Math.round((distanceKm / 20) * 60)) : null;
  const refunded = (order.refunds || []).filter((r) => r.status !== 'failed').reduce((a, r) => a + r.amount, 0);
  const canArrive = collecting && ['confirmed', 'packed', 'ready_for_collection'].includes(statusStr);
  const slot = order.fulfilment?.asap === false && order.fulfilment?.slotStart
    ? `${new Date(order.fulfilment.slotStart).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${new Date(order.fulfilment.slotStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–${new Date(order.fulfilment.slotEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : 'As soon as possible';
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
                  {STATUS_LABELS[statusStr] || statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{collecting ? 'You collect' : 'Delivery'}</Text>
              <Text style={styles.summaryValue}>{slot}</Text>
            </View>
            {statusStr === 'shipped' && order.delivery?.rider ? (
              <View style={{ marginTop: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.primarySubtle, gap: 4 }}>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                  {order.delivery.riderName || 'Your rider'} is on the way
                </Text>
                <Text style={styles.summaryLabel}>
                  {distanceKm != null
                    ? `About ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away · roughly ${etaMins} min`
                    : 'Waiting for the rider\'s location…'}
                </Text>
                {here ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${here.lat},${here.lng}`)}>
                    <Text style={[styles.summaryLabel, { color: Colors.primary, fontWeight: '700' }]}>See the rider on a map</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {refunded > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{order.paymentMethod === 'online' ? 'Refunded' : 'Taken off'}</Text>
                <Text style={[styles.summaryValue, { color: Colors.successText }]}>£{(refunded / 100).toFixed(2)}</Text>
              </View>
            ) : null}
            {collecting && order.fulfilment?.arrivedAt && statusStr !== 'collected' ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Store notified</Text>
                <Text style={[styles.summaryValue, { color: Colors.successText }]}>
                  You arrived at {new Date(order.fulfilment.arrivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
            {order.tracking?.estimatedReadyAt && ['confirmed', 'packed'].includes(statusStr) ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ready by</Text>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                  {new Date(order.tracking.estimatedReadyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
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
            <PriceLines lines={order.priceLines} />
            {order.customerNote ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Your note</Text>
                <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right', marginLeft: Spacing.md }]}>{order.customerNote}</Text>
              </View>
            ) : null}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{(order.total / 100).toFixed(2)}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <>
          {canArrive && (
            <Button
              title={order.fulfilment?.arrivedAt ? "I'm here (tell the store again)" : "I've arrived"}
              size="full"
              loading={arriving}
              onPress={handleArrived}
              icon={<Feather name="map-pin" size={16} color={Colors.white} />}
              style={{ marginTop: Spacing.base }}
            />
          )}
          {order.orderStatus === 'pending' && (
            <Button
              title="Cancel order"
              variant="danger"
              size="full"
              loading={cancelling}
              onPress={handleCancel}
              icon={<Feather name="x-circle" size={16} color={Colors.white} />}
              style={{ marginTop: Spacing.base }}
            />
          )}
          {statusStr !== 'cancelled' ? (
            <Button
              title="Repeat this order regularly"
              variant="outline"
              size="full"
              onPress={() => navigation.navigate('RepeatOrderSetup', {
                orderId: order._id,
                storeName: order.store?.name || '',
                ageCheck: order.ageCheck || 0,
              })}
              icon={<Feather name="repeat" size={16} color={Colors.primary} />}
              style={{ marginTop: Spacing.base }}
            />
          ) : null}
          <Button
            title="Order again"
            variant="outline"
            size="full"
            loading={reordering}
            onPress={handleReorder}
            icon={<Feather name="rotate-ccw" size={16} color={Colors.primary} />}
            style={{ marginTop: Spacing.base, marginBottom: 120 }}
          />
          </>
        }
      />

      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReviewId ? 'Edit Your Review' : 'Rate & Review'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Feather name="x" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {selectedItemForReview && (
                <View style={styles.modalProductRow}>
                  <Image
                    source={{
                      uri: selectedItemForReview.product?.images?.[0] ||
                           'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop'
                    }}
                    style={styles.modalProductImage}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalProductTitle} numberOfLines={2}>
                      {selectedItemForReview.product?.title || 'Product'}
                    </Text>
                    <Text style={styles.modalProductSubtitle}>
                      Order #{order?.orderNumber || order?._id?.slice(-6)?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.modalSectionLabel}>Overall Rating</Text>
              <View style={styles.starsSelectorRow}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.starSelectBtn, num === rating && styles.starSelectBtnActive]}
                    onPress={() => setRating(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.bigStarText, { color: num <= rating ? '#FFB800' : '#CBD5E1' }]}>
                      ★
                    </Text>
                    <Text style={[styles.starLabelText, num === rating && styles.starLabelTextActive]}>
                      {num === 1 ? 'Poor' : num === 2 ? 'Fair' : num === 3 ? 'Good' : num === 4 ? 'Very Good' : 'Excellent'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalSectionLabel}>Review Title (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Fantastic quality and fast delivery!"
                placeholderTextColor={Colors.muted}
                value={reviewTitle}
                onChangeText={setReviewTitle}
                maxLength={120}
              />

              <View style={styles.labelRow}>
                <Text style={styles.modalSectionLabel}>Your Review</Text>
                <Text style={styles.charCount}>{reviewBody.length}/4000</Text>
              </View>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="What did you like or dislike? How was the quality and value?"
                placeholderTextColor={Colors.muted}
                value={reviewBody}
                onChangeText={setReviewBody}
                multiline
                numberOfLines={4}
                maxLength={4000}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!reviewBody.trim() || submittingReview) && styles.submitBtnDisabled
                ]}
                disabled={!reviewBody.trim() || submittingReview}
                onPress={handleSubmitReview}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingReviewId ? 'Update Review' : 'Submit Review'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  itemContainerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    overflow: 'hidden',
  },
  itemRowInner: {
    flexDirection: 'row',
    padding: Spacing.md,
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
  reviewSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#F8FAFC',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  rateBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  starBadgeText: {
    color: '#D97706',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rateBtnTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.primary,
  },
  rateBtnSubtitle: {
    fontSize: 11,
    color: Colors.muted,
  },
  existingReviewBox: {
    paddingVertical: Spacing.xs,
  },
  existingReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  starsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIconText: {
    fontSize: 15,
    marginRight: 2,
  },
  existingRatingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 4,
  },
  editReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  editReviewText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 4,
  },
  existingReviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  existingReviewBody: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    maxHeight: '85%',
    ...Shadow.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h4,
    color: Colors.text,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  modalScroll: {
    padding: Spacing.lg,
  },
  modalProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalProductImage: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
    backgroundColor: Colors.border,
  },
  modalProductTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  modalProductSubtitle: {
    ...Typography.caption,
    color: Colors.muted,
  },
  modalSectionLabel: {
    ...Typography.subtitle,
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  starsSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  starSelectBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  starSelectBtnActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF08A',
  },
  bigStarText: {
    fontSize: 26,
    marginBottom: 2,
  },
  starLabelText: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: '500',
  },
  starLabelTextActive: {
    color: '#D97706',
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 11,
    color: Colors.muted,
  },
  modalTextArea: {
    height: 100,
    paddingTop: Spacing.sm,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.muted,
    opacity: 0.7,
  },
  submitBtnText: {
    ...Typography.subtitle,
    color: Colors.white,
  },
});
