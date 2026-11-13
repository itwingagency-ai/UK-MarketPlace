import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createCategory, getCategories, updateCategory } from '../../api/vendor.api';
import { useCustomAlert } from '../../context/AlertContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { ScreenHeader, Card, ToggleRow, SelectField, PickerSheet, Loading, sharedStyles } from '../../components/vendor/VendorUI';
import { apiError, descendantIds, flattenCategoryTree, imagePart } from '../../utils/catalog';
import { Colors, Radius, Spacing, Typography } from '../../theme';

export default function VendorCategoryFormScreen({ navigation, route }) {
  const { categoryId, parentId } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  const [categories, setCategories] = useState(null);
  const [name, setName] = useState('');
  const [parent, setParent] = useState(parentId || '');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState(null); // existing URL
  const [newImage, setNewImage] = useState(null); // picker asset
  const [nameError, setNameError] = useState(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = categories?.find((c) => c._id === categoryId);

  useEffect(() => {
    getCategories()
      .then((res) => {
        const list = res.data || [];
        setCategories(list);
        const cat = list.find((c) => c._id === categoryId);
        if (cat) {
          setName(cat.name);
          setParent(cat.parent || '');
          setDescription(cat.description || '');
          setSortOrder(String(cat.sortOrder || 0));
          setIsActive(cat.isActive);
          setImage(cat.image || null);
        }
      })
      .catch(() => setCategories([]));
  }, [categoryId]);

  // A category can't move under itself or anything beneath it
  const parentOptions = useMemo(() => {
    if (!categories) return [];
    const blocked = categoryId ? descendantIds(categories, categoryId) : new Set();
    return [{ value: '', label: 'None — this is a main category' }].concat(
      flattenCategoryTree(categories)
        .filter((c) => !blocked.has(String(c._id)))
        .map((c) => ({ value: c._id, label: c.name, depth: c.depth }))
    );
  }, [categories, categoryId]);
  const parentPath = categories ? flattenCategoryTree(categories).find((c) => c._id === parent)?.path : null;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      showAlert({ title: 'Image too large', message: 'Choose an image of 5 MB or smaller.', icon: 'image', showCancel: false, confirmText: 'OK' });
      return;
    }
    setNewImage(asset);
  };

  const save = async () => {
    if (name.trim().length < 2) {
      setNameError('Enter a name (at least 2 letters)');
      return;
    }
    const order = Number(sortOrder || 0);
    if (!Number.isInteger(order) || order < 0 || order > 9999) {
      showAlert({ title: 'Check display order', message: 'Use a whole number from 0 to 9999.', icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
      return;
    }
    setNameError(null);

    const form = new FormData();
    form.append('name', name.trim());
    form.append('parent', parent || '');
    form.append('description', description.trim());
    form.append('sortOrder', String(order));
    form.append('isActive', isActive ? 'true' : 'false');
    if (newImage) form.append('categoryImage', imagePart(newImage, 'category'));

    setSaving(true);
    try {
      if (editing) await updateCategory(editing._id, form);
      else await createCategory(form);
      navigation.goBack();
    } catch (err) {
      showAlert({ title: "Couldn't save category", message: apiError(err, 'Please try again.'), icon: 'alert-circle', showCancel: false, confirmText: 'OK' });
    } finally {
      setSaving(false);
    }
  };

  const title = categoryId ? 'Edit category' : parentId ? 'Add subcategory' : 'Add category';
  const preview = newImage?.uri || image;

  return (
    <View style={sharedStyles.screen}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {!categories ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[sharedStyles.content, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled">
            <Card>
              <Input
                label="Category name *"
                placeholder="e.g. Sweets & Bakery"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                error={nameError}
                maxLength={80}
              />
              <SelectField
                label="Inside category"
                value={parentPath}
                placeholder="None — this is a main category"
                onPress={() => setParentOpen(true)}
                help='Choose a parent to make this a subcategory, e.g. "Cakes" inside "Sweets & Bakery".'
              />
              <Input
                label="Description"
                placeholder="Optional — shown to customers"
                value={description}
                onChangeText={setDescription}
                autoCapitalize="sentences"
                multiline
                maxLength={500}
                inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              <Input label="Display order" keyboardType="number-pad" value={sortOrder} onChangeText={setSortOrder} />
              <Text style={[sharedStyles.help, { marginTop: -Spacing.sm, marginBottom: Spacing.sm }]}>
                Lower numbers appear first. Equal numbers are sorted A–Z.
              </Text>
              <ToggleRow label="Visible to customers" help="Hiding a category also hides everything inside it." value={isActive} onValueChange={setIsActive} />

              <Text style={[sharedStyles.fieldLabel, { marginTop: Spacing.md }]}>Image</Text>
              <Pressable onPress={pickImage} style={styles.imageBox} accessibilityRole="button" accessibilityLabel="Choose category image">
                {preview ? (
                  <Image source={{ uri: preview }} style={styles.image} />
                ) : (
                  <>
                    <Feather name="image" size={22} color={Colors.primary} />
                    <Text style={styles.imageText}>Choose image</Text>
                  </>
                )}
              </Pressable>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <View style={[styles.bar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button title={categoryId ? 'Save changes' : 'Create category'} size="full" loading={saving} onPress={save} disabled={!categories} />
      </View>

      <PickerSheet
        visible={parentOpen}
        title="Inside which category?"
        options={parentOptions}
        selected={parent}
        onSelect={(v) => setParent(v || '')}
        onClose={() => setParentOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  imageBox: {
    width: 120,
    height: 120,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primarySubtle,
  },
  image: { width: '100%', height: '100%' },
  imageText: { fontFamily: Typography.family.semibold, fontSize: 12, color: Colors.primary },
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
