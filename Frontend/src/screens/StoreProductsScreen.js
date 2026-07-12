import React, { useState, useEffect, useCallback, useMemo, TouchableWithoutFeedback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Image,
  ScrollView,
  Modal,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStoreProducts } from '../api/stores.api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const PRODUCT_CARD_W = (width - Spacing.lg * 2 - Spacing.md) / 2;

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, navigation, onRequireLogin }) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const [adding, setAdding] = useState(false);

  const handleAddToCart = async () => {
    if (adding) return;
    
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }

    // Prevent adding products with variants directly
    if (product.variants && product.variants.length > 0) {
      Alert.alert('Select Variant', 'This product has multiple options. Please view details to select one.');
      return;
    }

    setAdding(true);
    const res = await addItem(product._id || product.id, 1);
    setAdding(false);

    if (!res.success) {
      Alert.alert('Error', res.error || 'Failed to add item to cart');
    }
  };

  const priceInPounds = (product.price / 100).toFixed(2);
  const comparePriceInPounds = product.compareAtPrice
    ? (product.compareAtPrice / 100).toFixed(2)
    : null;
  const hasDiscount = comparePriceInPounds && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;

  const imageUrl = product.images?.[0] || 'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';

  return (
    <View style={productStyles.card}>
      <View style={productStyles.imgWrapper}>
        <Image source={{ uri: imageUrl }} style={productStyles.image} resizeMode="contain" />
        {hasDiscount && (
          <View style={productStyles.discountBadge}>
            <Text style={productStyles.discountText}>-{discountPct}%</Text>
          </View>
        )}
        <TouchableOpacity style={productStyles.heartBtn} activeOpacity={0.7} onPress={handleAddToCart}>
          <Ionicons name="heart-outline" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={productStyles.info}>
        <Text style={productStyles.productName} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={productStyles.nutritionRow}>
          <Feather name="target" size={12} color="#10B981" style={{ marginRight: 4 }} />
          <Text style={productStyles.nutritionText}>{product.description || "200 kcal/100ml"}</Text>
        </View>

        <View style={productStyles.priceRow}>
          <Text style={productStyles.price}>£{priceInPounds}</Text>
          {hasDiscount && (
            <Text style={productStyles.comparePrice}>£{comparePriceInPounds}</Text>
          )}
        </View>

        <TouchableOpacity style={productStyles.addBtn} activeOpacity={0.85} onPress={handleAddToCart}>
          {adding ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Feather name="plus" size={18} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StoreProductsScreen({ route, navigation }) {
  const { store, category } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const itemCount = cart?.itemCount ?? 0;
  const total = cart?.total ?? 0;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnder5, setFilterUnder5] = useState(false);
  const [filterOffer, setFilterOffer] = useState(false);
  const [filterInStock, setFilterInStock] = useState(false);
  const [sortPrice, setSortPrice] = useState(null); // 'low' or 'high'
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!store?.slug) return;
    setLoading(true);
    try {
      const params = { page: 1, limit: 50 };
      if (category && category.slug !== 'all') params.category = category.slug;

      const data = await getStoreProducts(store.slug, params);
      const fetched = data?.data?.products ?? data?.products ?? [];
      const fetchedTotal = data?.data?.total ?? data?.total ?? fetched.length;

      setProducts(fetched);
      setTotalProducts(fetchedTotal);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, [store?.slug, category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categoryName = category?.name || category?.label || 'Products';

  const displayedProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q));
    }
    if (filterUnder5) {
      result = result.filter(p => p.price <= 500);
    }
    if (filterOffer) {
      result = result.filter(p => p.compareAtPrice && p.compareAtPrice > p.price);
    }
    if (filterInStock) {
      result = result.filter(p => p.stock > 0);
    }

    if (sortPrice === 'low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortPrice === 'high') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, searchQuery, filterUnder5, filterOffer, filterInStock, sortPrice]);

  const renderProduct = ({ item }) => <ProductCard product={item} navigation={navigation} onRequireLogin={() => setLoginModalVisible(true)} />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>{totalProducts} products</Text>
        </View>

        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8}>
          <Feather name="filter" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color={Colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${categoryName}`}
          placeholderTextColor={Colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <Feather name="x" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <TouchableOpacity
            style={[styles.filterPill, sortPrice && styles.filterPillActive]}
            activeOpacity={0.8}
            onPress={() => setSortModalVisible(true)}
          >
            <Text style={[styles.filterPillText, sortPrice && styles.filterPillTextActive]}>
              Sort: {sortPrice === 'low' ? 'Low Price' : sortPrice === 'high' ? 'High Price' : 'Default'}
            </Text>
            <Feather name="chevron-down" size={16} color={sortPrice ? Colors.primary : Colors.text} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, filterUnder5 && styles.filterPillActive]}
            activeOpacity={0.8}
            onPress={() => setFilterUnder5(!filterUnder5)}
          >
            <Text style={[styles.filterPillText, filterUnder5 && styles.filterPillTextActive]}>Under £5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, filterOffer && styles.filterPillActive]}
            activeOpacity={0.8}
            onPress={() => setFilterOffer(!filterOffer)}
          >
            <Text style={[styles.filterPillText, filterOffer && styles.filterPillTextActive]}>On offer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, filterInStock && styles.filterPillActive]}
            activeOpacity={0.8}
            onPress={() => setFilterInStock(!filterInStock)}
          >
            <Text style={[styles.filterPillText, filterInStock && styles.filterPillTextActive]}>In stock</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Products Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedProducts}
          keyExtractor={(item) => item._id ?? item.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No products match your filters.</Text>
            </View>
          }
        />
      )}

      {/* Floating Cart Button */}
      {!keyboardVisible && itemCount > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('BasketTab')}
          >
            <Ionicons name="cart-outline" size={22} color={Colors.white} />
            <Text style={styles.floatingCartText}>
              View basket • {itemCount} items • £{(total / 100).toFixed(2)}
            </Text>
            <Feather name="chevron-right" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setSortModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Sort Products</Text>

                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setSortPrice(null); setSortModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, !sortPrice && styles.modalOptionActive]}>Default</Text>
                  {!sortPrice && <Feather name="check" size={20} color={Colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setSortPrice('low'); setSortModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, sortPrice === 'low' && styles.modalOptionActive]}>Price: Low to High</Text>
                  {sortPrice === 'low' && <Feather name="check" size={20} color={Colors.primary} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { setSortPrice('high'); setSortModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, sortPrice === 'high' && styles.modalOptionActive]}>Price: High to Low</Text>
                  {sortPrice === 'high' && <Feather name="check" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Login Required Modal */}
      <Modal visible={loginModalVisible} transparent animationType="fade">
        <View style={styles.centerModalOverlay}>
          <View style={styles.centerModalContent}>
            <View style={styles.modalIconWrapper}>
              <Feather name="lock" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.centerModalTitle}>Login Required</Text>
            <Text style={styles.centerModalText}>
              Please log in or create an account to add items to your basket.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnSecondary]} 
                activeOpacity={0.8}
                onPress={() => setLoginModalVisible(false)}
              >
                <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnPrimary]} 
                activeOpacity={0.8}
                onPress={() => {
                  setLoginModalVisible(false);
                  navigation.navigate('AccountTab');
                }}
              >
                <Text style={styles.modalBtnTextPrimary}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.white,
  },
  headerIconBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    height: 48,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.text,
    height: '100%',
  },

  filtersContainer: {
    marginBottom: Spacing.md,
  },
  filtersScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
  },
  filterPillActive: {
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Colors.primary,
  },

  productList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120, // space for cart
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.muted,
    fontSize: 15,
  },

  floatingCartContainer: {
    position: 'absolute',
    bottom: 90, // Positioned above the bottom navbar
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  floatingCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 79, 79, 0.90)', // translucent red from figma
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.full,
    gap: Spacing.sm,
    shadowColor: '#FF4F4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingCartText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  modalOptionActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  centerModalContent: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  centerModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  centerModalText: {
    fontSize: 15,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalBtnTextSecondary: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnTextPrimary: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

const productStyles = StyleSheet.create({
  card: {
    width: PRODUCT_CARD_W,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    position: 'relative',
  },
  imgWrapper: {
    width: '100%',
    height: 140,
    backgroundColor: '#F9F8F6',
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF4F4F',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  discountText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  heartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  info: {
    paddingHorizontal: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 6,
    height: 36, // Force two lines
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  nutritionText: {
    fontSize: 12,
    color: Colors.muted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  comparePrice: {
    fontSize: 13,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF4F4F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF4F4F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
