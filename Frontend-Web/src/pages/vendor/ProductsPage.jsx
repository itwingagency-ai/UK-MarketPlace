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
import { formatDate } from '../../utils/formatters';
import { Package, Plus, Edit2, Trash2, Archive, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Table filters and pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [localVariants, setLocalVariants] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        active: statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined,
        category: categoryFilter || undefined,
      };
      const res = await vendorService.getProducts(params);
      setProducts(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await vendorService.getCategories();
      setCategories(res.data || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Handle Search and Filters reset page
  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  /* ── Bulk Actions ───────────────────────────────────────────────────── */
  const handleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      const promises = Array.from(selectedIds).map((id) => {
        if (action === 'activate') return vendorService.restoreProduct(id);
        if (action === 'deactivate') return vendorService.updateProduct(id, { isActive: false });
        if (action === 'delete') return vendorService.deleteProduct(id); // Soft delete
        return Promise.resolve();
      });
      await Promise.all(promises);
      toast.success(`Bulk action completed for ${selectedIds.size} products`);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err) {
      toast.error('Failed to complete bulk action');
      setLoading(false); // fetchProducts won't trigger if we errored out before refetch
    }
  };

  /* ── Drawer Actions ─────────────────────────────────────────────────── */
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setLocalVariants([]);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct({
      ...product,
      category: product.category?._id || '',
      images: product.images?.join(', ') || ''
    });
    setLocalVariants(product.variants || []);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async (values) => {
    try {
      setSubmitting(true);
      
      const payload = { ...values };
      // Always convert string images to array, empty string becomes empty array
      if (typeof payload.images === 'string') {
        payload.images = payload.images ? payload.images.split(',').map(u => u.trim()).filter(Boolean) : [];
      }
      if (!payload.compareAtPrice) payload.compareAtPrice = null;
      if (!payload.category) payload.category = null;
      
      payload.variants = localVariants.map(v => ({
        ...v,
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null
      }));

      if (editingProduct) {
        await vendorService.updateProduct(editingProduct._id, payload);
        toast.success('Product updated successfully');
      } else {
        await vendorService.createProduct(payload);
        toast.success('Product created successfully');
      }
      handleCloseDrawer();
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Single Actions ─────────────────────────────────────────────────── */
  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setSubmitting(true);
      await vendorService.deleteProduct(deletingId);
      toast.success('Product archived successfully');
      setDeleteModalOpen(false);
      setDeletingId(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to archive product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await vendorService.restoreProduct(id);
      toast.success('Product restored successfully');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore product');
    }
  };

  /* ── UI Config ──────────────────────────────────────────────────────── */
  const columns = [
    {
      key: 'images',
      label: 'Image',
      width: 60,
      render: (v) => (
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {v && v.length > 0 ? (
            <img src={v[0]} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Package size={20} color="var(--gray-400)" />
          )}
        </div>
      )
    },
    {
      key: 'title',
      label: 'Product Details',
      sortable: true,
      render: (v, row) => (
        <div>
          <strong style={{ color: 'var(--gray-900)' }}>{v}</strong>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
            {row.category ? row.category.name : 'Uncategorized'}
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (v, row) => (
        <div>
          <strong style={{ color: 'var(--gray-900)' }}>£{Number(v).toFixed(2)}</strong>
          {row.compareAtPrice && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', textDecoration: 'line-through' }}>
              £{Number(row.compareAtPrice).toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      render: (v) => (
        <span style={{ 
          color: v <= 5 ? 'var(--aa-red)' : 'inherit', 
          fontWeight: v <= 5 ? '600' : 'normal' 
        }}>
          {v} {v <= 5 && <span style={{ fontSize: 'var(--text-xs)' }}>(Low)</span>}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      width: 120,
      render: (v) => <StatusBadge status={v ? 'active' : 'archived'} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      width: 120,
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v).split(',')[0]}</span>,
    },
  ];

  const categoryOptions = useMemo(() => {
    return [
      { value: '', label: 'Uncategorized' },
      ...categories.map(c => ({ value: c._id, label: c.name }))
    ];
  }, [categories]);

  const renderVariants = (row) => {
    if (!row.variants || row.variants.length === 0) {
      return <div style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-2)' }}>No variants available for this product. Click Edit to add some.</div>;
    }
    return (
      <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Product Variants</h4>
        <table style={{ width: '100%', fontSize: 'var(--text-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--gray-500)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Description</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>SKU</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Price</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {row.variants.map((v, i) => (
              <tr key={v._id || i} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                <td style={{ padding: '8px' }}>{v.attributes?.description || `Variant #${i + 1}`}</td>
                <td style={{ padding: '8px' }}>{v.sku || '-'}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>£{Number(v.price).toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{v.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Products"
        subtitle="Manage your inventory and catalog"
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Products' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Product
          </button>
        }
      />

      <div className="card">
        {/* Table Toolbar / Bulk Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)', background: 'var(--gray-50)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select 
                className="form-input" 
                value={statusFilter} 
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                style={{ height: 36, py: 0 }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Archived</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select 
                className="form-input" 
                value={categoryFilter} 
                onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                style={{ height: 36, py: 0 }}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>
                {selectedIds.size} selected
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => handleBulkAction('activate')} title="Activate Selected">
                <CheckCircle size={14} /> Activate
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleBulkAction('deactivate')} title="Deactivate Selected">
                <XCircle size={14} /> Deactivate
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleBulkAction('delete')} title="Archive Selected">
                <Archive size={14} /> Archive
              </button>
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          totalItems={total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          searchable
          searchValue={search}
          onSearch={handleSearch}
          selectable
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          rowKey="_id"
          expandable={renderVariants}
          emptyIcon={<Package />}
          emptyTitle="No Products Found"
          emptyText="You haven't added any products matching this criteria yet."
          actions={(row) => (
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleOpenEdit(row)}
                title="Edit Product"
              >
                <Edit2 size={14} />
              </button>
              {row.isActive ? (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteClick(row._id)}
                  title="Archive Product"
                >
                  <Archive size={14} />
                </button>
              ) : (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleRestore(row._id)}
                  title="Restore Product"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          )}
        />
      </div>

      <Drawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        width={600}
      >
        <FormBuilder
          fields={[
            {
              name: 'title',
              label: 'Product Title',
              type: 'text',
              required: true,
              placeholder: 'e.g. Wireless Noise-Cancelling Headphones',
            },
            {
              name: 'description',
              label: 'Description',
              type: 'textarea',
              placeholder: 'Detailed product description',
              rows: 5,
            },
            {
              name: 'category',
              label: 'Category',
              type: 'select',
              options: categoryOptions,
            },
            {
              name: 'price',
              label: 'Price (£)',
              type: 'number',
              required: true,
              placeholder: '0.00',
              step: '0.01',
              min: '0',
            },
            {
              name: 'compareAtPrice',
              label: 'Compare at Price (£)',
              type: 'number',
              placeholder: '0.00',
              helpText: 'Used to show a discount (crossed-out price).',
              step: '0.01',
              min: '0',
            },
            {
              name: 'stock',
              label: 'Inventory Stock',
              type: 'number',
              required: true,
              placeholder: '0',
              min: '0',
            },
            {
              name: 'images',
              label: 'Product Images (URLs)',
              type: 'textarea',
              placeholder: 'https://example.com/image1.jpg, https://example.com/image2.jpg',
              helpText: 'Enter image URLs separated by commas.',
              rows: 3,
            },
            {
              name: 'isActive',
              label: 'Active (Visible to customers)',
              type: 'switch',
            },
          ]}
          initialValues={
            editingProduct || {
              title: '',
              description: '',
              category: '',
              price: '',
              compareAtPrice: '',
              stock: 0,
              images: '',
              isActive: true,
            }
          }
          onSubmit={handleSave}
          submitText={editingProduct ? 'Save Changes' : 'Create Product'}
          loading={submitting}
        >
          {/* Variants Section */}
          <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: '600' }}>Product Variants</h3>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                onClick={() => setLocalVariants([...localVariants, { sku: '', price: '', stock: 0, attributes: { description: '' } }])}
              >
                <Plus size={14} /> Add Variant
              </button>
            </div>
            
            {localVariants.length === 0 ? (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', padding: 'var(--space-4)', textAlign: 'center', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                No variants added. The base product details will be used.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {localVariants.map((v, i) => (
                  <div key={i} style={{ padding: 'var(--space-3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <strong style={{ fontSize: 'var(--text-sm)' }}>Variant #{i + 1}</strong>
                      <button 
                        type="button" 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: 'var(--aa-red)', padding: '4px' }}
                        onClick={() => {
                          const updated = [...localVariants];
                          updated.splice(i, 1);
                          setLocalVariants(updated);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <div>
                        <label style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginBottom: 4, display: 'block' }}>Attributes / Description</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontSize: 'var(--text-sm)', height: 32 }}
                          placeholder="e.g. Size: M, Color: Red"
                          value={v.attributes?.description || ''}
                          onChange={(e) => {
                            const updated = [...localVariants];
                            updated[i] = { ...updated[i], attributes: { ...updated[i].attributes, description: e.target.value } };
                            setLocalVariants(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginBottom: 4, display: 'block' }}>SKU</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontSize: 'var(--text-sm)', height: 32 }}
                          placeholder="Variant SKU"
                          value={v.sku || ''}
                          onChange={(e) => {
                            const updated = [...localVariants];
                            updated[i] = { ...updated[i], sku: e.target.value };
                            setLocalVariants(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginBottom: 4, display: 'block' }}>Price (£) *</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          style={{ fontSize: 'var(--text-sm)', height: 32 }}
                          min="0" step="0.01" required
                          value={v.price !== undefined ? v.price : ''}
                          onChange={(e) => {
                            const updated = [...localVariants];
                            updated[i] = { ...updated[i], price: e.target.value };
                            setLocalVariants(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginBottom: 4, display: 'block' }}>Stock</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          style={{ fontSize: 'var(--text-sm)', height: 32 }}
                          min="0"
                          value={v.stock !== undefined ? v.stock : ''}
                          onChange={(e) => {
                            const updated = [...localVariants];
                            updated[i] = { ...updated[i], stock: e.target.value };
                            setLocalVariants(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormBuilder>
      </Drawer>

      <Modal
        open={deleteModalOpen}
        onClose={() => !submitting && setDeleteModalOpen(false)}
        title="Archive Product"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={submitting}>
              {submitting ? 'Archiving...' : 'Confirm Archive'}
            </button>
          </>
        }
      >
        <p>Are you sure you want to archive this product?</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-2)' }}>
          Archived products will not be visible to customers. You can restore them later.
        </p>
      </Modal>
    </div>
  );
}
