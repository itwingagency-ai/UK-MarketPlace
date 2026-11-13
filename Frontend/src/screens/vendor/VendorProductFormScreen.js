import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createProduct, getCategories, getProduct, updateProduct } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import {
  ScreenHeader,
  Card,
  SectionTitle,
  ToggleRow,
  SelectField,
  PickerSheet,
  ActionSheet,
  Loading,
  EmptyState,
  sharedStyles,
} from '../../components/vendor/VendorUI';
import {
  MAX_IMAGES_PER_UPLOAD,
  MAX_PRODUCT_IMAGES,
  apiError,
  emptyVariantRow,
  flattenCategoryTree,
  fromPriceFields,
  imagePart,
  toPriceFields,
  variantPayload,
  variantStateFromProduct,
} from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const MAX_BYTES = 5 * 1024 * 1024;
const EMPTY = {
  title: '',
  description: '',
  category: '',
  size: '',
  regularPrice: '',
  salePrice: '',
  stock: '0',
  isActive: true,
};

function PhotoStrip({ kept, added, onChange, onAdd }) {
  const total = kept.length + added.length;
  const all = [...kept.map((uri) => ({ uri, kept: true })), ...added.map((a) => ({ uri: a.uri, asset: a }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
      {all.map((photo, i) => (
        <View key={photo.uri} style={styles.photo}>
          <Image source={{ uri: photo.uri }} style={styles.photoImg} />
          {i === 0 ? (
            <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>
          ) : photo.kept ? (
            <Pressable
              style={[styles.photoBtn, { left: 4, bottom: 4 }]}
              onPress={() => onChange({ kept: [photo.uri, ...kept.filter((u) => u !== photo.uri)], added })}
              accessibilityLabel="Make main photo"
              hitSlop={6}
            >
              <Feather name="star" size={12} color={Colors.white} />
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.photoBtn, { right: 4, top: 4 }]}
            onPress={() =>
              photo.kept
                ? onChange({ kept: kept.filter((u) => u !== photo.uri), added })
                : onChange({ kept, added: added.filter((a) => a !== photo.asset) })
            }
            accessibilityLabel="Remove photo"
            hitSlop={6}
          >
            <Feather name="x" size={12} color={Colors.white} />
          </Pressable>
        </View>
      ))}
      {total < MAX_PRODUCT_IMAGES ? (
        <Pressable style={[styles.photo, styles.addPhoto]} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add photos">
          <Feather name="camera" size={22} color={Colors.primary} />
          <Text style={styles.addPhotoText}>Add photo</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export default function VendorProductFormScreen({ navigation, route }) {
  const productId = route.params?.productId;
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [values, setValues] = useState(EMPTY);
  const [photos, setPhotos] = useState({ kept: [], added: [] });
  const [variants, setVariants] = useState({ enabled: false, optionName: 'Size', rows: [] });
  const [loading, setLoading] = useState(!!productId);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [titleError, setTitleError] = useState(null);

  useEffect(() => {
    getCategories().then((res) => setCategories(res.data || [])).catch(() => {});
    if (!productId) return;
    getProduct(productId)
      .then((res) => {
        const p = res.data;
        setProduct(p);
        setValues({
          title: p.title,
          description: p.description || '',
          category: p.category?._id || '',
          size: p.size || '',
          ...toPriceFields(p.price, p.compareAtPrice),
          stock: String(p.stock ?? 0),
          isActive: p.isActive,
        });
        setPhotos({ kept: p.images || [], added: [] });
        setVariants(variantStateFromProduct(p));
      })
      .catch((err) => setLoadError(apiError(err, "Couldn't load this product")))
      .finally(() => setLoading(false));
  }, [productId]);

  const tree = useMemo(() => flattenCategoryTree(categories), [categories]);
  const categoryLabel = tree.find((c) => String(c._id) === String(values.category))?.path;
  const set = (key) => (v) => setValues((prev) => ({ ...prev, [key]: v }));

  const addAssets = (assets) => {
    const room = Math.min(MAX_PRODUCT_IMAGES - photos.kept.length - photos.added.length, MAX_IMAGES_PER_UPLOAD - photos.added.length);
    const ok = assets.filter((a) => !a.fileSize || a.fileSize <= MAX_BYTES);
    if (ok.length < assets.length) {
      showAlert({ title: 'Photo too large', message: 'Each photo must be 5 MB or smaller.', icon: 'image', showCancel: false, confirmText: 'OK' });
    }
    if (ok.length > room) {
      showAlert({
        title: 'Photo limit',
        message: room > 0 ? `You can add ${room} more photo${room === 1 ? '' : 's'} now. Save, then add more.` : 'Remove a photo first.',
        icon: 'image',
        showCancel: false,
        confirmText: 'OK',
      });
    }
    const next = ok.slice(0, Math.max(room, 0));
    if (next.length) setPhotos((prev) => ({ ...prev, added: [...prev.added, ...next] }));
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES_PER_UPLOAD,
      quality: 0.7,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert({ title: 'Camera access needed', message: 'Allow camera access in your phone settings to take product photos.', icon: 'camera-off', showCancel: false, confirmText: 'OK' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) addAssets(result.assets);
  };

  const fail = (message) =>
    showAlert({ title: 'Check your product', message, icon: 'alert-circle', showCancel: false, confirmText: 'OK' });

  const save = async () => {
    if (values.title.trim().length < 2) {
      setTitleError('Enter a product name (at least 2 letters)');
      return;
    }
    setTitleError(null);

    const form = new FormData();
    form.append('title', values.title.trim());
    form.append('description', values.description.trim());
    form.append('category', values.category || '');
    form.append('isActive', values.isActive ? 'true' : 'false');

    if (variants.enabled) {
      const built = variantPayload(variants);
      if (built.error) return fail(built.error);
      form.append('options', JSON.stringify(built.options));
      form.append('variants', JSON.stringify(built.variants));
      form.append('size', '');
    } else {
      const prices = fromPriceFields(values.regularPrice, values.salePrice);
      if (prices.error) return fail(prices.error);
      const stock = Number(values.stock);
      if (!Number.isInteger(stock) || stock < 0) return fail('Quantity in stock must be a whole number, 0 or more');
      form.append('size', values.size.trim());
      form.append('price', String(prices.price));
      form.append('compareAtPrice', prices.compareAtPrice == null ? '' : String(prices.compareAtPrice));
      const hadVariants = (product?.variants?.length || 0) > 0;
      if (hadVariants) {
        form.append('options', '[]');
        form.append('variants', '[]');
      }
      // Only send stock the shopkeeper changed, so a sale made while this
      // screen was open isn't overwritten by the old number.
      if (!product || hadVariants || String(values.stock) !== String(product.stock)) form.append('stock', String(stock));
    }

    if (product) form.append('images', JSON.stringify(photos.kept));
    photos.added.forEach((asset, i) => form.append('productImages', imagePart(asset, `product-${i + 1}`)));

    setSaving(true);
    try {
      if (product) await updateProduct(product._id, form);
      else await createProduct(form);
      navigation.goBack();
    } catch (err) {
      fail(apiError(err, "Couldn't save. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  const setRow = (i, patch) =>
    setVariants((prev) => ({ ...prev, rows: prev.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));

  if (loading || loadError) {
    return (
      <View style={sharedStyles.screen}>
        <ScreenHeader title="Edit product" onBack={() => navigation.goBack()} />
        {loadError ? <EmptyState icon="alert-circle" title="Couldn't load product" body={loadError} /> : <Loading />}
      </View>
    );
  }

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title={product ? 'Edit product' : 'Add product'} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={sharedStyles.fieldLabel}>Photos</Text>
            <PhotoStrip kept={photos.kept} added={photos.added} onChange={setPhotos} onAdd={() => setPhotoMenu(true)} />
            <Text style={[sharedStyles.help, { marginTop: Spacing.sm }]}>
              The first photo is shown in your shop. Up to {MAX_PRODUCT_IMAGES} photos.
            </Text>
          </Card>

          <SectionTitle>Details</SectionTitle>
          <Card>
            <Input
              label="Product name *"
              placeholder="e.g. Chocolate Fudge Cake"
              value={values.title}
              onChangeText={set('title')}
              autoCapitalize="sentences"
              error={titleError}
              maxLength={140}
            />
            <Input
              label="Description"
              placeholder="Ingredients, flavour, serving size…"
              value={values.description}
              onChangeText={set('description')}
              autoCapitalize="sentences"
              multiline
              maxLength={2500}
              inputStyle={{ minHeight: 96, textAlignVertical: 'top' }}
            />
            <SelectField
              label="Category"
              value={categoryLabel}
              placeholder="No category"
              onPress={() => setCategoryOpen(true)}
              help={categories.length === 0 ? 'Create categories from the Products tab › Categories.' : undefined}
            />
            <ToggleRow
              label="Visible to customers"
              help="Switch off to hide it from your shop without deleting it."
              value={values.isActive}
              onValueChange={set('isActive')}
            />
          </Card>

          <SectionTitle>Price & stock</SectionTitle>
          <Card>
            <ToggleRow
              label="Comes in different sizes"
              help="e.g. Small, Medium and Large — each with its own price and stock."
              value={variants.enabled}
              onValueChange={(on) =>
                setVariants((prev) => ({ ...prev, enabled: on, rows: on && prev.rows.length === 0 ? [emptyVariantRow()] : prev.rows }))
              }
            />

            {!variants.enabled ? (
              <View style={{ marginTop: Spacing.sm }}>
                <Input label="Size / weight" placeholder="e.g. 500 g, 1 kg, Box of 6" value={values.size} onChangeText={set('size')} maxLength={60} />
                <View style={styles.twoCol}>
                  <Input style={{ flex: 1 }} label="Regular price (£) *" placeholder="0.00" keyboardType="decimal-pad" value={values.regularPrice} onChangeText={set('regularPrice')} />
                  <Input style={{ flex: 1 }} label="Sale price (£)" placeholder="Optional" keyboardType="decimal-pad" value={values.salePrice} onChangeText={set('salePrice')} />
                </View>
                <Input label="Quantity in stock *" keyboardType="number-pad" value={values.stock} onChangeText={set('stock')} />
                <Text style={sharedStyles.help}>Shows “Out of stock” automatically at 0. A sale price shows the regular price crossed out.</Text>
              </View>
            ) : (
              <View style={{ marginTop: Spacing.sm }}>
                <Input
                  label="Option name"
                  placeholder="e.g. Size, Weight, Pack"
                  value={variants.optionName}
                  onChangeText={(v) => setVariants((prev) => ({ ...prev, optionName: v }))}
                  autoCapitalize="words"
                  maxLength={40}
                />
                {variants.rows.map((row, i) => (
                  <View key={row._id || `new-${i}`} style={[styles.variant, !row.isActive && { opacity: 0.7 }]}>
                    <View style={styles.variantHead}>
                      <Text style={styles.variantTitle}>{row.value || `${variants.optionName || 'Option'} ${i + 1}`}</Text>
                      <Pressable
                        onPress={() => setVariants((prev) => ({ ...prev, rows: prev.rows.filter((_, idx) => idx !== i) }))}
                        disabled={variants.rows.length === 1}
                        hitSlop={8}
                        accessibilityLabel="Remove this size"
                      >
                        <Feather name="trash-2" size={18} color={variants.rows.length === 1 ? Colors.border : Colors.errorText} />
                      </Pressable>
                    </View>
                    <Input label={`${variants.optionName || 'Option'} *`} placeholder="e.g. Small" value={row.value} onChangeText={(v) => setRow(i, { value: v })} autoCapitalize="words" maxLength={60} />
                    <View style={styles.twoCol}>
                      <Input style={{ flex: 1 }} label="Regular (£) *" placeholder="0.00" keyboardType="decimal-pad" value={row.regularPrice} onChangeText={(v) => setRow(i, { regularPrice: v })} />
                      <Input style={{ flex: 1 }} label="Sale (£)" placeholder="Optional" keyboardType="decimal-pad" value={row.salePrice} onChangeText={(v) => setRow(i, { salePrice: v })} />
                      <Input style={{ flex: 1 }} label="In stock" keyboardType="number-pad" value={row.stock} onChangeText={(v) => setRow(i, { stock: v })} />
                    </View>
                    <ToggleRow label="Available to buy" value={row.isActive} onValueChange={(v) => setRow(i, { isActive: v })} />
                  </View>
                ))}
                <Button
                  title={`Add another ${(variants.optionName || 'option').toLowerCase()}`}
                  variant="outline"
                  icon={<Feather name="plus" size={16} color={Colors.primary} />}
                  onPress={() => setVariants((prev) => ({ ...prev, rows: [...prev.rows, emptyVariantRow()] }))}
                  disabled={variants.rows.length >= 50}
                />
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button title={product ? 'Save changes' : 'Add product'} size="full" loading={saving} onPress={save} />
      </View>

      <PickerSheet
        visible={categoryOpen}
        title="Choose a category"
        options={[{ value: '', label: 'No category' }].concat(tree.map((c) => ({ value: c._id, label: c.name, depth: c.depth, hint: c.isActive ? undefined : 'Hidden from customers' })))}
        selected={values.category}
        onSelect={(v) => set('category')(v || '')}
        onClose={() => setCategoryOpen(false)}
      />
      <ActionSheet
        visible={photoMenu}
        title="Add photos"
        onClose={() => setPhotoMenu(false)}
        actions={[
          { label: 'Take a photo', icon: 'camera', onPress: takePhoto },
          { label: 'Choose from gallery', icon: 'image', onPress: pickFromLibrary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: 92,
    height: 92,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  photoImg: { width: '100%', height: '100%' },
  photoBtn: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  mainBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  mainBadgeText: { fontFamily: Typography.family.bold, fontSize: 10, color: Colors.white },
  addPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primarySubtle,
  },
  addPhotoText: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.primary },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  variant: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  variantHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  variantTitle: { fontFamily: Typography.family.bold, fontSize: 15, color: Colors.text },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
