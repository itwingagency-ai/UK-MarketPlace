import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { deleteCategory, getCategories, updateCategory } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import {
  ScreenHeader,
  Card,
  Pill,
  EmptyState,
  Loading,
  ActionSheet,
  Fab,
  sharedStyles,
} from '../../components/vendor/VendorUI';
import { apiError, flattenCategoryTree } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

export default function VendorCategoriesScreen({ navigation }) {
  const { showAlert } = useCustomAlert();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getCategories();
      setCategories(res.data || []);
      setError(null);
    } catch (err) {
      setError(apiError(err, "Couldn't load categories"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tree = useMemo(() => flattenCategoryTree(categories), [categories]);
  const childCount = useMemo(() => {
    const counts = new Map();
    for (const c of categories) {
      if (c.parent) counts.set(String(c.parent), (counts.get(String(c.parent)) || 0) + 1);
    }
    return counts;
  }, [categories]);

  const alertError = (err, title) =>
    showAlert({ title, message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });

  const toggleVisibility = async (cat) => {
    try {
      await updateCategory(cat._id, { isActive: !cat.isActive });
      load();
    } catch (err) {
      alertError(err, "Couldn't update category");
    }
  };

  const requestDelete = (cat) => {
    const subs = childCount.get(String(cat._id)) || 0;
    const products = cat.productCount || 0;
    if (subs || products) {
      const reasons = [
        subs ? `It has ${subs} subcategor${subs === 1 ? 'y' : 'ies'} — move or delete them first.` : null,
        products ? `It holds ${products} product${products === 1 ? '' : 's'} — move them to another category first.` : null,
      ].filter(Boolean);
      showAlert({
        title: `Can't delete "${cat.name}" yet`,
        message: `${reasons.join('\n')}\n\nTo take it off your shop without deleting anything, hide it instead.`,
        icon: 'alert-circle',
        confirmText: cat.isActive ? 'Hide instead' : 'OK',
        cancelText: 'Close',
        showCancel: cat.isActive,
        onConfirm: cat.isActive ? () => toggleVisibility(cat) : undefined,
      });
      return;
    }
    showAlert({
      title: `Delete "${cat.name}"?`,
      message: 'This category is empty. Deleting it can’t be undone.',
      isDestructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteCategory(cat._id);
          load();
        } catch (err) {
          alertError(err, "Couldn't delete category");
        }
      },
    });
  };

  const renderRow = ({ item }) => {
    const subs = childCount.get(String(item._id)) || 0;
    return (
      <Card onPress={() => setMenuFor(item)} style={[styles.row, { marginLeft: item.depth * 18 }, !item.isActive && { opacity: 0.7 }]}>
        {item.depth > 0 ? <Feather name="corner-down-right" size={14} color={Colors.muted} /> : null}
        <View style={styles.thumb}>
          {item.image ? <Image source={{ uri: item.image }} style={styles.thumbImg} /> : <Feather name="folder" size={18} color={Colors.primary} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={sharedStyles.help}>
            {item.productCount || 0} product{item.productCount === 1 ? '' : 's'}
            {subs ? ` · ${subs} subcategor${subs === 1 ? 'y' : 'ies'}` : ''}
          </Text>
        </View>
        {!item.isActive ? <Pill label="Hidden" /> : null}
        <Feather name="more-vertical" size={18} color={Colors.textSecondary} />
      </Card>
    );
  };

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title="Categories" subtitle="Tap a category to edit or add inside it" onBack={() => navigation.goBack()} />
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={tree}
          keyExtractor={(c) => c._id}
          renderItem={renderRow}
          contentContainerStyle={[sharedStyles.content, { paddingBottom: 140 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState icon="wifi-off" title="Couldn't load categories" body={error} actionLabel="Try again" onAction={load} />
            ) : (
              <EmptyState
                icon="folder-plus"
                title="Organise your shop"
                body="Create main categories like “Sweets & Bakery”, then add subcategories such as “Cakes” inside them."
                actionLabel="Add category"
                onAction={() => navigation.navigate('VendorCategoryForm')}
              />
            )
          }
        />
      )}

      <Fab label="Add category" bottom={32} onPress={() => navigation.navigate('VendorCategoryForm')} />

      <ActionSheet
        visible={!!menuFor}
        title={menuFor?.path}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? [
          { label: 'Add a subcategory inside', icon: 'folder-plus', onPress: () => navigation.navigate('VendorCategoryForm', { parentId: menuFor._id }) },
          { label: 'Edit category', icon: 'edit-2', onPress: () => navigation.navigate('VendorCategoryForm', { categoryId: menuFor._id }) },
          {
            label: 'See its products',
            icon: 'package',
            onPress: () => navigation.navigate('VendorTabs', { screen: 'VendorProductsTab', params: { categoryId: menuFor._id } }),
          },
          {
            label: menuFor.isActive ? 'Hide from customers' : 'Show to customers',
            icon: menuFor.isActive ? 'eye-off' : 'eye',
            onPress: () => toggleVisibility(menuFor),
          },
          { label: 'Delete', icon: 'trash-2', destructive: true, onPress: () => requestDelete(menuFor) },
        ] : []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontFamily: Typography.family.semibold, fontSize: 15, color: Colors.text },
});
