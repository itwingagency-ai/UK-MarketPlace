import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }) {
  const { product } = route.params;
  const { addItem, itemCount, total } = useCart();
  const { isAuthenticated } = useAuth();
  const { favoriteProducts, toggleFavoriteProduct } = useFavorites();

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const productId = product._id || product.id;
  const isFavorited = favoriteProducts.some(p => p._id === productId || p === productId);

  const imageUrl = product.images?.[0] || 'https://images.unsplash.com/photo-1550508117-a006c00661ff?q=80&w=400&auto=format&fit=crop';
  const priceInPounds = (product.price / 100).toFixed(2);

  const handleFavoriteToggle = () => {
    if (!isAuthenticated) {
      navigation.navigate('AccountTab');
      return;
    }
    toggleFavoriteProduct(productId);
  };

  const handleAddToCart = async () => {
    if (adding) return;

    if (!isAuthenticated) {
      navigation.navigate('AccountTab');
      return;
    }

    if (product.variants && product.variants.length > 0) {
      Alert.alert('Notice', 'Variants are not fully supported yet in this prototype.');
      return;
    }

    setAdding(true);
    const res = await addItem(productId, quantity);
    setAdding(false);

    if (res.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', res.error || 'Failed to add item to cart');
    }
  };

  const increment = () => setQuantity(prev => prev + 1);
  const decrement = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          
          {/* Header Controls */}
          <SafeAreaView style={styles.headerControls} edges={['top']}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleFavoriteToggle}>
              <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={24} color={isFavorited ? "#50178E" : Colors.text} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.productName}>{product.title}</Text>
          </View>
          
          <Text style={styles.productPrice}>£{priceInPounds}</Text>

          <View style={styles.metaRow}>
            <Feather name="info" size={16} color={Colors.muted} style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>{product.description || 'Details unavailable'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quantityContainer}>
          <TouchableOpacity style={styles.qtyBtn} onPress={decrement}>
            <Feather name="minus" size={20} color={quantity > 1 ? Colors.text : Colors.muted} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={increment}>
            <Feather name="plus" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.addBtn} 
          activeOpacity={0.8}
          onPress={handleAddToCart}
        >
          {adding ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.addBtnText}>Add • £{((product.price * quantity) / 100).toFixed(2)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  scrollContent: { paddingBottom: 100 },
  imageContainer: {
    width: width,
    height: width, // Square image
    backgroundColor: '#F9F8F6',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  headerControls: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  infoContainer: {
    padding: Spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  productName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
    lineHeight: 30,
  },
  productPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  metaText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xl + 20, // Extra padding for safe area
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadow.md,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: Spacing.lg,
  },
  qtyBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginHorizontal: Spacing.md,
    width: 24,
    textAlign: 'center',
  },
  addBtn: {
    flex: 1,
    backgroundColor: '#D81B60',
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
