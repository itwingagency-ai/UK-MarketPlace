import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TextInput, Image, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import {
  getCategories,
  getProducts,
  hideProduct,
  showProduct,
  deleteProductPermanently,
} from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import { formatPence } from '../../components/ProductCard';
import {
  ScreenHeader,
  IconButton,
  Card,
  Chip,
  ChipRow,
  Pill,
  StockPill,
  EmptyState,
  Loading,
  PickerSheet,
  ActionSheet,
  Fab,
  sharedStyles,
} from '../../components/vendor/VendorUI';
import { apiError, flattenCategoryTree, stockLevel } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const PAGE_SIZE = 20;
const FILTERS = [
  ['all', 'All'],
  ['visible', 'Visible'],
  ['hidden', 'Hidden'],
  ['low', 'Low stock'],
  ['out', 'Out of stock'],
];

export default function VendorProductsScreen({ navigation, route }) {
  const { showAlert } = useCustomAlert();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const requestId = useRef(0);

  // Opened from a category's "See its products"
  useEffect(() => {
    if (route.params?.categoryId) {
      setLoading(true);
      setCategoryId(route.params.categoryId);
    }
  }, [route.params?.categoryId]);

  const tree = useMemo(() => flattenCategoryTree(categories), [categories]);
  const paths = useMemo(() => new Map(tree.map((c) => [String(c._id), c.path])), [tree]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (pageNum = 1) => {
    const id = ++requestId.current;
    if (pageNum > 1) setLoadingMore(true);
    try {
      const params = {
        page: pageNum,
        limit: PAGE_SIZE,
        search: query || undefined,
        category: categoryId || undefined,
        active: filter === 'visible' ? 'true' : filter === 'hidden' ? 'false' : undefined,
        stock: filter === 'low' || filter === 'out' ? filter : undefined,
      };
      const res = await getProducts(params);
      if (id !== requestId.current) return;
      setProducts((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.total);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(apiError(err, "Couldn't load products"));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [query, categoryId, filter]);

  useFocusEffect(useCallback(() => {
    load(1);
    getCategories().then((res) => setCategories(res.data || [])).catch(() => {});
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  };

  const toggleVisibility = async (product) => {
    try {
      if (product.isActive) await hideProduct(product._id);
      else await showProduct(product._id);
      load(1);
    } catch (err) {
      showAlert({ title: "Couldn't update product", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    }
  };

  const confirmDelete = (product) =>
    showAlert({
      title: 'Delete permanently?',
      message: `"${product.title}" and its photos are removed for good. Past orders keep their record of it.`,
      isDestructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteProductPermanently(product._id);
          load(1);
        } catch (err) {
          showAlert({ title: "Couldn't delete", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
        }
      },
    });

  const renderProduct = ({ item }) => {
    const level = stockLevel(item);
    const hasVariants = item.variants?.length > 0;
    return (
      <Card
        onPress={() => navigation.navigate('VendorProductForm', { productId: item._id })}
        style={[styles.row, !item.isActive && styles.rowHidden]}
      >
        <View style={styles.thumb}>
          {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.thumbImg} /> : <Feather name="image" size={20} color={Colors.muted} />}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={sharedStyles.help} numberOfLines={1}>
            {item.category ? paths.get(String(item.category._id)) || item.category.name : 'No category'}
            {item.size ? ` · ${item.size}` : ''}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.price}>{hasVariants ? 'from ' : ''}{formatPence(item.price)}</Text>
            <Text style={sharedStyles.help}>{level.stock} in stock</Text>
          </View>
          <View style={styles.metaRow}>
            <StockPill out={level.out} low={level.low} />
            {!item.isActive ? <Pill label="Hidden" tone="neutral" /> : null}
            {hasVariants ? <Pill label={`${item.variants.length} sizes`} tone="primary" /> : null}
          </View>
        </View>
        <Pressable onPress={() => setMenuFor(item)} hitSlop={10} accessibilityLabel={`More actions for ${item.title}`} style={styles.more}>
          <Feather name="more-vertical" size={20} color={Colors.textSecondary} />
        </Pressable>
      </Card>
    );
  };

  const categoryOptions = [{ value: '', label: 'All categories' }, { value: 'none', label: 'No category' }].concat(
    tree.map((c) => ({ value: c._id, label: c.name, depth: c.depth }))
  );
  const activeFilters = filter !== 'all' || categoryId || query;

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader
        title="Products"
        subtitle={!loading ? `${total} ${total === 1 ? 'product' : 'products'}` : undefined}
        right={
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <IconButton icon="folder" label="Categories" onPress={() => navigation.navigate('VendorCategories')} />
            <IconButton icon="layers" label="Stock" onPress={() => navigation.navigate('VendorInventory')} />
          </View>
        }
      />
      <View style={styles.controls}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your products"
            placeholderTextColor={Colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10}><Feather name="x-circle" size={18} color={Colors.muted} /></Pressable>
          ) : null}
        </View>
        <ChipRow>
          <Chip
            icon="folder"
            label={categoryId ? (categoryId === 'none' ? 'No category' : tree.find((c) => c._id === categoryId)?.name || 'Category') : 'Category'}
            active={!!categoryId}
            onPress={() => setPickerOpen(true)}
          />
          {FILTERS.map(([key, label]) => (
            <Chip key={key} label={label} active={filter === key} onPress={() => { setLoading(true); setFilter(key); }} />
          ))}
        </ChipRow>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p._id}
          renderItem={renderProduct}
          contentContainerStyle={[sharedStyles.content, { paddingTop: Spacing.sm, paddingBottom: 180 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={() => { if (!loadingMore && products.length < total) load(page + 1); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.base }} /> : null}
          ListEmptyComponent={
            error ? (
              <EmptyState icon="wifi-off" title="Couldn't load products" body={error} actionLabel="Try again" onAction={() => load(1)} />
            ) : activeFilters ? (
              <EmptyState icon="search" title="No matching products" body="Try another search or filter." />
            ) : (
              <EmptyState
                icon="package"
                title="Add your first product"
                body="Give it a name, price and photo — it appears in your shop straight away."
                actionLabel="Add product"
                onAction={() => navigation.navigate('VendorProductForm')}
              />
            )
          }
        />
      )}

      <Fab label="Add product" onPress={() => navigation.navigate('VendorProductForm')} />

      <PickerSheet
        visible={pickerOpen}
        title="Filter by category"
        options={categoryOptions}
        selected={categoryId}
        onSelect={(v) => { setLoading(true); setCategoryId(v || ''); }}
        onClose={() => setPickerOpen(false)}
      />
      <ActionSheet
        visible={!!menuFor}
        title={menuFor?.title}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? [
          { label: 'Edit product', icon: 'edit-2', onPress: () => navigation.navigate('VendorProductForm', { productId: menuFor._id }) },
          { label: 'Update stock', icon: 'layers', onPress: () => navigation.navigate('VendorInventory', { search: menuFor.title }) },
          {
            label: menuFor.isActive ? 'Hide from customers' : 'Show to customers',
            icon: menuFor.isActive ? 'eye-off' : 'eye',
            onPress: () => toggleVisibility(menuFor),
          },
          !menuFor.isActive ? { label: 'Delete permanently', icon: 'trash-2', destructive: true, onPress: () => confirmDelete(menuFor) } : null,
        ] : []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 46,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontFamily: Typography.family.regular, fontSize: 15, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  rowHidden: { opacity: 0.7 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  price: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  more: { paddingTop: 2 },
});
