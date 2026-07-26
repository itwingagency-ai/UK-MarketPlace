import React, { useState, useEffect } from 'react';
import {
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
import { getMyOrderById } from '../api/orders.api';
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

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyOrderById(orderId);
      setOrder(res.data);
      const statusStr = (res.data?.orderStatus || '').toLowerCase();
      if (['shipped', 'delivered', 'completed'].includes(statusStr)) {
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
      ['delivered', 'completed'].includes((order.orderStatus || '').toLowerCase()) && 
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
              <Text style={styles.itemPrice}>
                £{(((item.unitPrice || item.price || 0) * item.quantity) / 100).toFixed(2)}
              </Text>
            </View>
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
