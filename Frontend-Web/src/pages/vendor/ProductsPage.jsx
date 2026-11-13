import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { vendorService } from '../../api/vendorService';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Drawer,
  FormBuilder,
  Modal
} from '../../components/common';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { categoryOptions, flattenCategoryTree } from '../../utils/categoryTree';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';
import ProductImageManager from './ProductImageManager';
import ProductVariantEditor, {
  fromPriceFields,
  toPriceFields,
  variantPayload,
  variantStateFromProduct,
} from './ProductVariantEditor';
import StockBadge, { stockLevel } from './StockBadge';
import { Package, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_PRODUCT = {
  title: '',
  description: '',
  category: '',
  size: '',
  regularPrice: '',
  salePrice: '',
  stock: 0,
  isActive: true,
};

const NO_VARIANTS = { enabled: false, optionName: 'Size', rows: [], combined: false };

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Table filters and pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [stockFilter, setStockFilter] = useState(searchParams.get('stock') || '');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [photos, setPhotos] = useState({ kept: [], added: [] });
  const [variantState, setVariantState] = useState(NO_VARIANTS);
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        active: statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined,
        category: categoryFilter || undefined,
        stock: stockFilter || undefined,
      };
      const res = await vendorService.getProducts(params);
      setProducts(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter, stockFilter]);

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

  const categoryPaths = useMemo(
    () => new Map(flattenCategoryTree(categories).map((c) => [String(c._id), c.path])),
    [categories]
  );
  const categorySelectOptions = useMemo(() => categoryOptions(categories), [categories]);

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
        if (action === 'show') return vendorService.restoreProduct(id);
        if (action === 'hide') return vendorService.updateProduct(id, { isActive: false });
        return Promise.resolve();
      });
      await Promise.all(promises);
      toast.success(`${selectedIds.size} product${selectedIds.size === 1 ? '' : 's'} ${action === 'show' ? 'shown in' : 'hidden from'} your shop`);
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
    setPhotos({ kept: [], added: [] });
    setVariantState(NO_VARIANTS);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setPhotos({ kept: product.images || [], added: [] });
    setVariantState(variantStateFromProduct(product));
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    photos.added.forEach((a) => URL.revokeObjectURL(a.preview));
    setDrawerOpen(false);
    setEditingProduct(null);
  };

  // Memoised: FormBuilder resets its values whenever this object changes
  const initialValues = useMemo(() => {
    if (!editingProduct) return EMPTY_PRODUCT;
    return {
      title: editingProduct.title,
      description: editingProduct.description || '',
      category: editingProduct.category?._id || '',
      size: editingProduct.size || '',
      ...toPriceFields(editingProduct.price, editingProduct.compareAtPrice),
      stock: editingProduct.stock ?? 0,
      isActive: editingProduct.isActive,
    };
  }, [editingProduct]);

  const handleSave = async (values) => {
    const payload = new FormData();
    payload.append('title', values.title.trim());
    payload.append('description', values.description || '');
    payload.append('category', values.category || '');
    payload.append('isActive', values.isActive ? 'true' : 'false');

    if (variantState.enabled) {
      const built = variantPayload(variantState);
      if (built.error) return toast.error(built.error);
      payload.append('options', JSON.stringify(built.options));
      payload.append('variants', JSON.stringify(built.variants));
      payload.append('size', '');
    } else {
      const prices = fromPriceFields(values.regularPrice, values.salePrice);
      if (prices.error) return toast.error(prices.error);
      const stock = Number(values.stock);
      if (!Number.isInteger(stock) || stock < 0) return toast.error('Stock must be a whole number, 0 or more');

      payload.append('size', (values.size || '').trim());
      payload.append('price', prices.price);
      payload.append('compareAtPrice', prices.compareAtPrice ?? '');
      const hadVariants = (editingProduct?.variants?.length || 0) > 0;
      if (hadVariants) {
        payload.append('options', '[]');
        payload.append('variants', '[]');
      }
      // Only send stock the shopkeeper changed, so a sale made while the form
      // was open isn't overwritten by the stale number.
      if (!editingProduct || hadVariants || String(values.stock) !== String(editingProduct.stock)) {
        payload.append('stock', stock);
      }
    }

    if (editingProduct) payload.append('images', JSON.stringify(photos.kept));
    photos.added.forEach((a) => payload.append('productImages', a.file));

    try {
      setSubmitting(true);
      if (editingProduct) {
        await vendorService.updateProduct(editingProduct._id, payload);
        toast.success('Product updated');
      } else {
        await vendorService.createProduct(payload);
        toast.success('Product created');
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
  const handleToggleVisibility = async (product) => {
    try {
      if (product.isActive) await vendorService.deleteProduct(product._id); // soft delete = hide
      else await vendorService.restoreProduct(product._id);
      toast.success(product.isActive ? 'Hidden from your shop' : 'Visible in your shop again');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update product');
    }
  };

  const handleDeleteClick = (product) => {
    setDeletingProduct(product);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setSubmitting(true);
      await vendorService.deleteProduct(deletingProduct._id, { hard: true });
      toast.success('Product deleted');
      setDeleteModalOpen(false);
      setDeletingProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    } finally {
      setSubmitting(false);
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
            {row.category ? categoryPaths.get(String(row.category._id)) || row.category.name : 'No category'}
            {row.size ? ` · ${row.size}` : ''}
            {row.variants?.length ? ` · ${row.variants.length} options` : ''}
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
          <strong style={{ color: 'var(--gray-900)' }}>
            {row.variants?.length ? <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>from </span> : null}
            {formatCurrency(v)}
          </strong>
          {row.compareAtPrice > v && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', textDecoration: 'line-through' }}>
              {formatCurrency(row.compareAtPrice)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'totalStock',
      label: 'Stock',
      sortable: true,
      render: (v, row) => {
        const level = stockLevel(row);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span style={{ fontWeight: level.out || level.low ? 600 : 'normal' }}>{level.stock}</span>
            <StockBadge {...level} />
          </div>
        );
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      width: 120,
      render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} label={v ? 'Visible' : 'Hidden'} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      width: 120,
      render: (v) => <span style={{ fontSize: 'var(--text-sm)' }}>{formatDate(v).split(',')[0]}</span>,
    },
  ];

  const renderVariants = (row) => {
    if (!row.variants || row.variants.length === 0) {
      return (
        <div style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-4)' }}>
          Single product{row.size ? ` (${row.size})` : ''} — {row.stock} in stock. Edit it to add sizes or options.
        </div>
      );
    }
    return (
      <div style={{ padding: 'var(--space-2) var(--space-4)', overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 'var(--text-sm)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--gray-500)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Option</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Price</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>Stock</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {row.variants.map((v, i) => (
              <tr key={v._id || i} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                <td style={{ padding: '8px' }}>{Object.values(v.attributes || {}).join(' / ') || `Option ${i + 1}`}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{formatCurrency(v.price)}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{v.stock}</td>
                <td style={{ padding: '8px' }}>
                  {v.isActive === false
                    ? <StatusBadge status="inactive" label="Unavailable" size="sm" />
                    : <StockBadge stock={v.stock} out={v.stock <= 0} low={v.stock > 0 && v.stock <= LOW_STOCK_THRESHOLD} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const formFields = [
    {
      name: 'title',
      label: 'Product Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Chocolate Fudge Cake',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'What customers should know: ingredients, flavour, serving size…',
      rows: 4,
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      placeholder: 'No category',
      options: categorySelectOptions,
      helpText: categories.length === 0
        ? 'You have no categories yet — create them on the Categories page.'
        : 'Pick the most specific one, e.g. "Sweets & Bakery › Cakes › Cupcakes".',
    },
    ...(variantState.enabled
      ? []
      : [
          {
            name: 'size',
            label: 'Size / weight',
            type: 'text',
            placeholder: 'e.g. 500 g, 1 kg, Box of 6',
          },
          {
            name: 'regularPrice',
            label: 'Regular price (£)',
            type: 'number',
            required: true,
            placeholder: '0.00',
            step: '0.01',
            min: '0',
          },
          {
            name: 'salePrice',
            label: 'Sale price (£)',
            type: 'number',
            placeholder: 'Optional',
            helpText: 'Fill this in to put the product on offer — customers see the regular price crossed out.',
            step: '0.01',
            min: '0',
          },
          {
            name: 'stock',
            label: 'Quantity in stock',
            type: 'number',
            required: true,
            placeholder: '0',
            min: '0',
            step: '1',
            helpText: 'Shows as "Out of stock" automatically when it reaches 0.',
          },
        ]),
    {
      name: 'isActive',
      label: 'Visible to customers',
      type: 'switch',
    },
  ];

  const activeFilters = statusFilter || categoryFilter || stockFilter;

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Products"
        subtitle="Add products, set prices and sizes, and choose what customers see"
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)', background: 'var(--gray-50)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ height: 36, width: 'auto' }}
              aria-label="Filter by visibility"
            >
              <option value="">Visible & hidden</option>
              <option value="active">Visible</option>
              <option value="inactive">Hidden</option>
            </select>
            <select
              className="form-select"
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              style={{ height: 36, width: 'auto', maxWidth: 260 }}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              <option value="none">No category</option>
              {categorySelectOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              className="form-select"
              value={stockFilter}
              onChange={e => { setStockFilter(e.target.value); setPage(1); }}
              style={{ height: 36, width: 'auto' }}
              aria-label="Filter by stock"
            >
              <option value="">Any stock level</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            {activeFilters && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setStatusFilter(''); setCategoryFilter(''); setStockFilter(''); setPage(1); }}
              >
                Clear filters
              </button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>
                {selectedIds.size} selected
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => handleBulkAction('show')} title="Show selected in your shop">
                <Eye size={14} /> Show
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleBulkAction('hide')} title="Hide selected from your shop">
                <EyeOff size={14} /> Hide
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
          emptyText={activeFilters || search ? 'No products match these filters.' : "You haven't added any products yet."}
          actions={(row) => (
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleOpenEdit(row)}
                title="Edit product"
              >
                <Edit2 size={14} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleToggleVisibility(row)}
                title={row.isActive ? 'Hide from your shop' : 'Show in your shop'}
              >
                {row.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              {!row.isActive && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDeleteClick(row)}
                  title="Delete permanently"
                  style={{ color: 'var(--danger-text)' }}
                >
                  <Trash2 size={14} />
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
          fields={formFields}
          initialValues={initialValues}
          onSubmit={handleSave}
          submitLabel={editingProduct ? 'Save Changes' : 'Create Product'}
          submitting={submitting}
        >
          <ProductImageManager
            kept={photos.kept}
            added={photos.added}
            onChange={setPhotos}
            disabled={submitting}
          />
          <ProductVariantEditor state={variantState} onChange={setVariantState} disabled={submitting} />
          {editingProduct && (
            <p className="form-help" style={{ marginTop: 'var(--space-3)' }}>
              Need to top up stock quickly? Use the <Link to="/vendor/inventory">Inventory</Link> page.
            </p>
          )}
        </FormBuilder>
      </Drawer>

      <Modal
        open={deleteModalOpen}
        onClose={() => !submitting && setDeleteModalOpen(false)}
        title="Delete Product"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={submitting}>
              {submitting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </>
        }
      >
        <p>Permanently delete <strong>{deletingProduct?.title}</strong>?</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginTop: 'var(--space-2)' }}>
          Its photos are removed too and this can’t be undone. Past orders keep their record of it.
          To take it off sale for now, leaving it hidden is enough.
        </p>
      </Modal>
    </div>
  );
}
