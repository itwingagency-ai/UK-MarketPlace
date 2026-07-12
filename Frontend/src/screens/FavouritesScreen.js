import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { useFavorites } from '../context/FavoritesContext';
import { useCart } from '../context/CartContext';

function StoreFavoriteCard({ store, onToggleFavorite, onPress }) {
  const imageUrl = store.branding?.bannerUrl || store.imageUrl || store.branding?.logoUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop';
  
  const ratingDisplay = store.averageRating ? Number(store.averageRating).toFixed(1) : 'New';
  const ratingCount = store.ratingCount ? `(${store.ratingCount}+)` : '';
  
  const deliveryTime = store.deliveryTime || '15-30 min';
  const deliveryFeeText = store.deliveryFee != null 
    ? (store.deliveryFee === 0 ? 'Free delivery' : `£${Number(store.deliveryFee).toFixed(2)} delivery`) 
    : 'In-Store Price';
    
  const categoryLabel = store.category || store.storeType || 'Grocery';
  const delivers = store.deliversToLocation !== false;

  return (
    <TouchableOpacity 
      style={[styles.card, !delivers && { opacity: 0.5 }]} 
      activeOpacity={0.9} 
      onPress={onPress}
      disabled={!delivers}
    >
      <ImageBackground source={{ uri: imageUrl }} style={styles.cardImage} imageStyle={{ borderRadius: Radius.lg }}>
        {!delivers && (
          <View style={styles.undeliverableBadge}>
            <Text style={styles.undeliverableText}>Does not deliver to your area</Text>
          </View>
        )}
        <TouchableOpacity 
          style={styles.heartBtn} 
          onPress={(e) => {
            e.stopPropagation();
            onToggleFavorite(store._id || store.id);
          }}
        >
          <Ionicons name="heart" size={20} color="#50178E" />
        </TouchableOpacity>
      </ImageBackground>
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>{ratingDisplay} <Text style={styles.ratingCount}>{ratingCount}</Text></Text>
          </View>
        </View>
        <Text style={styles.storeMeta} numberOfLines={1}>{deliveryTime} • {categoryLabel} • {deliveryFeeText}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ProductFavoriteCard({ product, onToggleFavorite, onPress }) {
  const imageUrl = product.images?.[0] || 'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';
  const delivers = product.deliversToLocation !== false;
  
  return (
    <TouchableOpacity 
      style={[styles.productCard, !delivers && { opacity: 0.5 }]} 
      activeOpacity={0.9} 
      onPress={onPress}
      disabled={!delivers}
    >
      <View style={styles.productImgWrapper}>
        <Image source={{ uri: imageUrl }} style={styles.productImage} />
        {!delivers && (
          <View style={styles.productUndeliverableBadge}>
            <Text style={styles.productUndeliverableText}>Not in your area</Text>
          </View>
        )}
        <TouchableOpacity style={styles.productHeartBtn} onPress={() => onToggleFavorite(product._id)}>
          <Ionicons name="heart" size={18} color="#50178E" />
        </TouchableOpacity>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.title}</Text>
        <Text style={styles.productPrice}>£{(product.price / 100).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function FavouritesScreen({ navigation }) {
  const { favoriteStores, favoriteProducts, toggleFavoriteStore, toggleFavoriteProduct } = useFavorites();
  const { itemCount } = useCart();
  const [activeTab, setActiveTab] = useState(
    favoriteStores.length === 0 && favoriteProducts.length > 0 ? 'Products' : 'Stores'
  ); // Stores | Products
  const [deliveryType, setDeliveryType] = useState('delivery');

  React.useEffect(() => {
    // If the user navigates to this screen and only has product favorites, switch to products
    const unsubscribe = navigation.addListener('focus', () => {
      if (favoriteStores.length === 0 && favoriteProducts.length > 0) {
        setActiveTab('Products');
      } else if (favoriteStores.length > 0 && favoriteProducts.length === 0) {
        setActiveTab('Stores');
      }
    });
    return unsubscribe;
  }, [navigation, favoriteStores.length, favoriteProducts.length]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favourites</Text>
          <TouchableOpacity onPress={() => navigation.navigate('BasketTab')} style={styles.iconBtn}>
            <Feather name="shopping-bag" size={22} color={Colors.text} />
            {itemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'Stores' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Stores')}
          >
            <Text style={[styles.tabText, activeTab === 'Stores' && styles.tabTextActive]}>Stores</Text>
            {activeTab === 'Stores' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'Products' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Products')}
          >
            <Text style={[styles.tabText, activeTab === 'Products' && styles.tabTextActive]}>Products</Text>
            {activeTab === 'Products' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {activeTab === 'Stores' ? (
          <FlatList
            key="stores-list"
            data={favoriteStores}
            keyExtractor={item => item._id || item.id || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <StoreFavoriteCard 
                store={item} 
                onToggleFavorite={toggleFavoriteStore}
                onPress={() => navigation.navigate('ShopHomeTab', { screen: 'StoreCategories', params: { store: item } })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No favorite stores yet.</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            key="products-list"
            data={favoriteProducts}
            keyExtractor={item => item._id || item.id || Math.random().toString()}
            numColumns={2}
            columnWrapperStyle={styles.productColumn}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <ProductFavoriteCard 
                product={item} 
                onToggleFavorite={toggleFavoriteProduct}
                onPress={() => navigation.navigate('ProductDetail', { product: item })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No favorite products yet.</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  safeArea: { backgroundColor: Colors.white, ...Shadow.sm, zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  iconBtn: { padding: Spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  badge: {
    position: 'absolute',
    top: 2, right: 2,
    backgroundColor: '#D81B60',
    borderRadius: 10,
    width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },
  
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.muted,
  },
  tabTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    width: '100%',
    height: 3,
    backgroundColor: Colors.text,
  },

  content: { flex: 1, backgroundColor: Colors.white },
  
  toggleContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  toggleBtnActive: {
    backgroundColor: '#333',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleTextActive: {
    color: Colors.white,
  },

  listContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  emptyContainer: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.muted,
  },

  // Store Card
  card: {
    marginBottom: Spacing.xl,
  },
  cardImage: {
    width: '100%',
    height: 180,
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  adBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginTop: 'auto',
  },
  adText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  heartBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.white,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  undeliverableBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  undeliverableText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  productUndeliverableBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  productUndeliverableText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  cardContent: {
    paddingTop: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 4,
  },
  ratingCount: {
    color: Colors.muted,
    fontWeight: '400',
  },
  storeMeta: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: Spacing.sm,
  },
  promoRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  promoBadgeLight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoTextLight: {
    fontSize: 12,
    color: '#D81B60',
    fontWeight: '500',
  },
  promoTags: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  promoBadgeSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE4ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  promoTextSolid: {
    fontSize: 11,
    color: '#D81B60',
    fontWeight: '700',
  },

  // Product Card
  productColumn: {
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  productCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  productImgWrapper: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.surfaceSecondary,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  productHeartBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.white,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  productInfo: {
    padding: Spacing.sm,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    height: 36, // 2 lines max
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
});
