import { useState, useEffect, useCallback, useMemo } from 'react';
import { vendorService } from '../../api/vendorService';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Drawer,
  FormBuilder,
  Modal
} from '../../components/common';
import { flattenCategoryTree, descendantIds } from '../../utils/categoryTree';
import { Tag, Plus, Edit2, Trash2, Eye, EyeOff, CornerDownRight, FolderPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_CATEGORY = {
  name: '',
  parent: '',
  slug: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newParentId, setNewParentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getCategories();
      setCategories(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const tree = useMemo(() => flattenCategoryTree(categories), [categories]);
  const childCount = useMemo(() => {
    const counts = new Map();
    for (const c of categories) {
      if (c.parent) counts.set(String(c.parent), (counts.get(String(c.parent)) || 0) + 1);
    }
    return counts;
  }, [categories]);

  const handleOpenCreate = (parentId = '') => {
    setEditingCategory(null);
    setNewParentId(parentId);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingCategory(null);
  };

  const handleSave = async (values) => {
    try {
      setSubmitting(true);
      const payload = new FormData();
      payload.append('name', values.name.trim());
      payload.append('parent', values.parent || '');
      payload.append('description', values.description || '');
      payload.append('sortOrder', values.sortOrder === '' ? 0 : values.sortOrder);
      payload.append('isActive', values.isActive ? 'true' : 'false');
      if (values.slug && values.slug.trim()) payload.append('slug', values.slug.trim().toLowerCase());
      if (values.imageFile) payload.append('categoryImage', values.imageFile);

      if (editingCategory) {
        await vendorService.updateCategory(editingCategory._id, payload);
        toast.success('Category updated');
      } else {
        await vendorService.createCategory(payload);
        toast.success(values.parent ? 'Subcategory created' : 'Category created');
      }
      handleCloseDrawer();
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async (category) => {
    try {
      await vendorService.updateCategory(category._id, { isActive: !category.isActive });
      toast.success(category.isActive ? `"${category.name}" is now hidden from customers` : `"${category.name}" is visible again`);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDeleteClick = (category) => {
    setDeletingCategory(category);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setSubmitting(true);
      await vendorService.deleteCategory(deletingCategory._id);
      toast.success('Category deleted');
      setDeleteModalOpen(false);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  // A category can't move under itself or anything beneath it
  const parentOptions = useMemo(() => {
    const blocked = editingCategory ? descendantIds(categories, editingCategory._id) : new Set();
    return tree
      .filter((c) => !blocked.has(String(c._id)))
      .map((c) => ({ value: c._id, label: `${'— '.repeat(c.depth)}${c.name}` }));
  }, [tree, categories, editingCategory]);

  const initialValues = useMemo(() => {
    if (!editingCategory) return { ...EMPTY_CATEGORY, parent: newParentId };
    return {
      name: editingCategory.name,
      parent: editingCategory.parent || '',
      slug: editingCategory.slug,
      description: editingCategory.description || '',
      sortOrder: editingCategory.sortOrder || 0,
      isActive: editingCategory.isActive,
    };
  }, [editingCategory, newParentId]);

  const columns = [
    {
      key: 'name',
      label: 'Category',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingLeft: row.depth * 24 }}>
          {row.depth > 0 && <CornerDownRight size={14} color="var(--gray-400)" style={{ flexShrink: 0 }} />}
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {row.image ? (
              <img src={row.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Tag size={18} color="var(--gray-400)" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: 'var(--gray-900)' }}>{v}</strong>
            {search && row.depth > 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{row.path}</div>
            )}
            {row.description && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
                {row.description.length > 60 ? `${row.description.substring(0, 60)}…` : row.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'productCount',
      label: 'Products',
      width: 100,
      render: (v, row) => {
        const subs = childCount.get(String(row._id)) || 0;
        return (
          <div>
            <span>{v || 0}</span>
            {subs > 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                {subs} subcategor{subs === 1 ? 'y' : 'ies'}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'sortOrder',
      label: 'Order',
      width: 80,
      render: (v) => <span style={{ color: 'var(--gray-500)' }}>{v || 0}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      width: 120,
      render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} label={v ? 'Visible' : 'Hidden'} />,
    },
  ];

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? tree.filter((c) => c.path.toLowerCase().includes(q) || c.slug.includes(q))
    : tree;

  const deleteBlockers = deletingCategory
    ? {
        products: deletingCategory.productCount || 0,
        children: childCount.get(String(deletingCategory._id)) || 0,
      }
    : { products: 0, children: 0 };
  const deleteBlocked = deleteBlockers.products > 0 || deleteBlockers.children > 0;

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Categories"
        subtitle="Organise your products into categories and subcategories"
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Categories' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenCreate()}>
            <Plus size={16} /> Add Category
          </button>
        }
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={visibleRows}
          loading={loading}
          searchable
          searchValue={search}
          onSearch={setSearch}
          rowKey="_id"
          emptyIcon={<Tag />}
          emptyTitle={q ? 'No matching categories' : 'No Categories'}
          emptyText={q ? 'Try a different search.' : 'Create your first category, then add subcategories inside it.'}
          actions={(row) => (
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleOpenCreate(row._id)}
                title={`Add a subcategory inside ${row.name}`}
              >
                <FolderPlus size={14} /> Sub
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleToggleVisibility(row)}
                title={row.isActive ? 'Hide from customers' : 'Show to customers'}
              >
                {row.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleOpenEdit(row)}
                title="Edit category"
              >
                <Edit2 size={14} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleDeleteClick(row)}
                title="Delete category"
                style={{ color: 'var(--danger-text)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        />
      </div>

      <Drawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title={editingCategory ? 'Edit Category' : newParentId ? 'Add Subcategory' : 'Add Category'}
        width={440}
      >
        <FormBuilder
          fields={[
            {
              name: 'name',
              label: 'Category Name',
              type: 'text',
              required: true,
              placeholder: 'e.g. Sweets & Bakery',
            },
            {
              name: 'parent',
              label: 'Inside category',
              type: 'select',
              placeholder: 'None — this is a main category',
              options: parentOptions,
              helpText: 'Choose a parent to make this a subcategory, e.g. "Cakes" inside "Sweets & Bakery".',
            },
            {
              name: 'description',
              label: 'Description',
              type: 'textarea',
              placeholder: 'Optional — shown to customers',
              rows: 3,
            },
            {
              name: 'sortOrder',
              label: 'Display order',
              type: 'number',
              min: '0',
              step: '1',
              helpText: 'Lower numbers appear first. Categories with the same number are sorted A–Z.',
            },
            {
              name: 'isActive',
              label: 'Visible to customers',
              type: 'switch',
            },
            {
              name: 'imageFile',
              label: 'Category Image',
              type: 'file',
              accept: 'image/jpeg,image/png,image/webp,image/gif',
              helpText: 'JPEG, PNG, WebP or GIF up to 5 MB.',
              previewUrls: editingCategory?.image ? [editingCategory.image] : undefined,
            },
            {
              name: 'slug',
              label: 'Web address (optional)',
              type: 'text',
              placeholder: 'Created from the name if left blank',
              helpText: 'Lowercase letters, numbers and hyphens only.',
            },
          ]}
          initialValues={initialValues}
          onSubmit={handleSave}
          submitLabel={editingCategory ? 'Save Changes' : 'Create Category'}
          submitting={submitting}
        />
      </Drawer>

      <Modal
        open={deleteModalOpen}
        onClose={() => !submitting && setDeleteModalOpen(false)}
        title="Delete Category"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteModalOpen(false)} disabled={submitting}>
              {deleteBlocked ? 'Close' : 'Cancel'}
            </button>
            {deleteBlocked ? (
              deletingCategory?.isActive && (
                <button
                  className="btn btn-secondary"
                  onClick={() => { setDeleteModalOpen(false); handleToggleVisibility(deletingCategory); }}
                >
                  <EyeOff size={14} /> Hide instead
                </button>
              )
            ) : (
              <button className="btn btn-danger" onClick={confirmDelete} disabled={submitting}>
                {submitting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </>
        }
      >
        {deleteBlocked ? (
          <>
            <p><strong>{deletingCategory?.name}</strong> can’t be deleted yet.</p>
            <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)' }}>
              {deleteBlockers.children > 0 && (
                <li>It has {deleteBlockers.children} subcategor{deleteBlockers.children === 1 ? 'y' : 'ies'} — move or delete them first.</li>
              )}
              {deleteBlockers.products > 0 && (
                <li>It holds {deleteBlockers.products} product{deleteBlockers.products === 1 ? '' : 's'} — move them to another category first.</li>
              )}
            </ul>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-3)' }}>
              To take it off your shop without deleting anything, hide it instead.
            </p>
          </>
        ) : (
          <>
            <p>Delete <strong>{deletingCategory?.name}</strong>?</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-2)' }}>
              This category is empty. Deleting it can’t be undone.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
