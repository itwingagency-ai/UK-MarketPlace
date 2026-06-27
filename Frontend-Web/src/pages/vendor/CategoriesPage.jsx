import { useState, useEffect, useCallback } from 'react';
import { vendorService } from '../../api/vendorService';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Drawer,
  FormBuilder,
  Modal
} from '../../components/common';
import { formatDate } from '../../utils/formatters';
import { Tag, Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

  const handleOpenCreate = () => {
    setEditingCategory(null);
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
      if (editingCategory) {
        await vendorService.updateCategory(editingCategory._id, values);
        toast.success('Category updated successfully');
      } else {
        await vendorService.createCategory(values);
        toast.success('Category created successfully');
      }
      handleCloseDrawer();
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setSubmitting(true);
      await vendorService.deleteCategory(deletingId);
      toast.success('Category deleted successfully');
      setDeleteModalOpen(false);
      setDeletingId(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Category Name',
      sortable: true,
      render: (v, row) => (
        <div>
          <strong style={{ color: 'var(--gray-900)' }}>{v}</strong>
          {row.description && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
              {row.description.length > 50 ? `${row.description.substring(0, 50)}...` : row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'slug',
      label: 'Slug',
      sortable: true,
      render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--primary)' }}>{v}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      width: 120,
      render: (v) => (
        <StatusBadge status={v ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      width: 140,
      render: (v) => formatDate(v),
    },
  ];

  // Filtering for search
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Categories"
        subtitle="Organise your products into categories"
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Categories' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Category
          </button>
        }
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={filteredCategories}
          loading={loading}
          searchable
          searchValue={search}
          onSearch={setSearch}
          rowKey="_id"
          emptyIcon={<Tag />}
          emptyTitle="No Categories"
          emptyText="You haven't created any product categories yet."
          actions={(row) => (
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleOpenEdit(row)}
                title="Edit Category"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteClick(row._id)}
                title="Delete Category"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        />
      </div>

      <Drawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        width={400}
      >
        <FormBuilder
          fields={[
            {
              name: 'name',
              label: 'Category Name',
              type: 'text',
              required: true,
              placeholder: 'e.g. Electronics',
            },
            {
              name: 'slug',
              label: 'URL Slug',
              type: 'text',
              required: true,
              placeholder: 'e.g. electronics',
              helpText: 'Must be lowercase and use hyphens instead of spaces.',
            },
            {
              name: 'description',
              label: 'Description',
              type: 'textarea',
              placeholder: 'Optional description of this category',
              rows: 3,
            },
            {
              name: 'isActive',
              label: 'Active (Visible to customers)',
              type: 'switch',
            },
          ]}
          initialValues={
            editingCategory || {
              name: '',
              slug: '',
              description: '',
              isActive: true,
            }
          }
          onSubmit={handleSave}
          submitText={editingCategory ? 'Save Changes' : 'Create Category'}
          loading={submitting}
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
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </>
        }
      >
        <p>Are you sure you want to delete this category?</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-2)' }}>
          This action cannot be undone. Products currently in this category will lose their category association.
        </p>
      </Modal>
    </div>
  );
}
