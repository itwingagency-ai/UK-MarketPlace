import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TextInput, Pressable, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { adjustStock, getProducts, getStockSummary } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import { ScreenHeader, Card, Chip, ChipRow, Pill, StockPill, EmptyState, Loading, sharedStyles } from '../../components/vendor/VendorUI';
import { LOW_STOCK_THRESHOLD, apiError, stockLevel, variantLabel } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const PAGE_SIZE = 20;

/**
 * − [count] + editor. Saving sends the difference from the number on screen
 * as an atomic adjustment, so a sale made while the shopkeeper was editing is
 * never undone; the row then shows the live count from the server.
 */
function StockStepper({ product, variant, onSaved }) {
  const { showAlert } = useCustomAlert();
  const current = Number(variant ? variant.stock : product.stock) || 0;
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(String(current)), [current]);

  const parsed = Number(value);
  const valid = value !== '' && Number.isInteger(parsed) && parsed >= 0;
  const dirty = value !== String(current);

  const step = (delta) => {
    const base = valid ? parsed : current;
    setValue(String(Math.max(0, base + delta)));
  };

  const save = async () => {
    if (!dirty || !valid || saving) return;
    setSaving(true);
    try {
      const res = await adjustStock(product._id, {
        adjust: parsed - current,
        ...(variant ? { variantId: variant._id } : {}),
      });
      const updated = res.data;
      const live = variant ? updated.variants.find((v) => v._id === variant._id)?.stock : updated.stock;
      if (live !== parsed) {
        showAlert({
          title: 'Stock saved',
          message: `An order came in while you were editing, so the count is now ${live}.`,
          icon: 'info',
          showCancel: false,
          confirmText: 'OK',
        });
      }
      onSaved(updated);
    } catch (err) {
      showAlert({ title: "Couldn't update stock", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepper}>
        <Pressable onPress={() => step(-1)} style={styles.stepBtn} hitSlop={4} accessibilityLabel="One fewer" disabled={saving}>
          <Feather name="minus" size={16} color={Colors.text} />
        </Pressable>
        <TextInput
          style={[styles.count, !valid && { color: Colors.errorText }]}
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          selectTextOnFocus
          editable={!saving}
          accessibilityLabel={variant ? `Stock for ${variantLabel(variant)}` : `Stock for ${product.title}`}
        />
        <Pressable onPress={() => step(1)} style={styles.stepBtn} hitSlop={4} accessibilityLabel="One more" disabled={saving}>
          <Feather name="plus" size={16} color={Colors.text} />
        </Pressable>
      </View>
      {dirty ? (
        <Pressable
          onPress={save}
          disabled={!valid || saving}
          style={[styles.saveBtn, (!valid || saving) && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel="Save stock"
        >
          {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function VendorInventoryScreen({ navigation, route }) {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState(route.params?.tab || '');
  const [search, setSearch] = useState(route.params?.search || '');
  const [query, setQuery] = useState(route.params?.search || '');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadSummary = useCallback(() => {
    getStockSummary().then((res) => setSummary(res.data)).catch(() => {});
  }, []);

  const load = useCallback(async (pageNum = 1) => {
    const id = ++requestId.current;
    if (pageNum > 1) setLoadingMore(true);
    try {
      const res = await getProducts({ page: pageNum, limit: PAGE_SIZE, stock: tab || undefined, search: query || undefined });
      if (id !== requestId.current) return;
      setProducts((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.total);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(apiError(err, "Couldn't load stock"));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [tab, query]);

  useFocusEffect(useCallback(() => {
    load(1);
    loadSummary();
  }, [load, loadSummary]));

  // Keep the edited row in place and refresh the counters
  const onSaved = (updated) => {
    setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    loadSummary();
  };

  const renderItem = ({ item }) => {
    const level = stockLevel(item);
    return (
      <Card>
        <View style={styles.head}>
          <View style={styles.thumb}>
            {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.thumbImg} /> : <Feather name="package" size={18} color={Colors.muted} />}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <View style={styles.pills}>
              <StockPill out={level.out} low={level.low} />
              {!item.isActive ? <Pill label="Hidden" /> : null}
            </View>
          </View>
        </View>
        {item.variants?.length ? (
          item.variants.map((variant, i) => (
            <View key={variant._id} style={styles.variantRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.variantName, variant.isActive === false && { color: Colors.muted }]}>{variantLabel(variant, i)}</Text>
                {variant.isActive === false ? (
                  <Text style={sharedStyles.help}>Not available to buy</Text>
                ) : variant.stock <= 0 ? (
                  <Text style={[sharedStyles.help, { color: Colors.errorText }]}>Out of stock</Text>
                ) : variant.stock <= LOW_STOCK_THRESHOLD ? (
                  <Text style={[sharedStyles.help, { color: Colors.warningText }]}>Low stock</Text>
                ) : null}
              </View>
              <StockStepper product={item} variant={variant} onSaved={onSaved} />
            </View>
          ))
        ) : (
          <View style={styles.variantRow}>
            <Text style={[styles.variantName, { flex: 1 }]}>In stock{item.size ? ` (${item.size})` : ''}</Text>
            <StockStepper product={item} onSaved={onSaved} />
          </View>
        )}
      </Card>
    );
  };

  const TABS = [
    ['', 'All', summary?.total],
    ['low', 'Low stock', summary?.low],
    ['out', 'Out of stock', summary?.out],
  ];

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Stock" subtitle={`Low stock means ${LOW_STOCK_THRESHOLD} or fewer left`} onBack={() => navigation.goBack()} />
      <View style={styles.controls}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products"
            placeholderTextColor={Colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <Pressable onPress={() => setSearch('')} hitSlop={10}><Feather name="x-circle" size={18} color={Colors.muted} /></Pressable> : null}
        </View>
        <ChipRow>
          {TABS.map(([key, label, count]) => (
            <Chip key={key || 'all'} label={label} count={count} active={tab === key} onPress={() => { setLoading(true); setTab(key); }} />
          ))}
        </ChipRow>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p._id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[sharedStyles.content, { paddingTop: Spacing.sm }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(1); loadSummary(); setRefreshing(false); }} tintColor={Colors.primary} />}
          onEndReached={() => { if (!loadingMore && products.length < total) load(page + 1); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.base }} /> : null}
          ListEmptyComponent={
            error ? (
              <EmptyState icon="wifi-off" title="Couldn't load stock" body={error} actionLabel="Try again" onAction={() => load(1)} />
            ) : (
              <EmptyState
                icon="check-circle"
                title={tab === 'low' ? 'Nothing running low' : tab === 'out' ? 'Nothing out of stock' : 'No products yet'}
                body={tab ? 'Everything here is well stocked.' : 'Add products first, then manage their stock here.'}
              />
            )
          }
        />
      )}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
  pills: { flexDirection: 'row', gap: Spacing.xs },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  variantName: { fontFamily: Typography.family.medium, fontSize: 14, color: Colors.text },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
  },
  stepBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  count: {
    minWidth: 46,
    textAlign: 'center',
    fontFamily: Typography.family.bold,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 0,
  },
  saveBtn: {
    height: 40,
    minWidth: 64,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  saveText: { fontFamily: Typography.family.bold, fontSize: 14, color: Colors.white },
});
