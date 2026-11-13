import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { vendorService } from '../../api/vendorService';
import { PageHeader, DataTable, StatCard, StatusBadge } from '../../components/common';
import { categoryOptions, flattenCategoryTree } from '../../utils/categoryTree';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';
import StockBadge, { stockLevel } from './StockBadge';
import { Boxes, AlertTriangle, PackageX, EyeOff, Package, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  ['', 'All products'],
  ['low', 'Low stock'],
  ['out', 'Out of stock'],
];

/**
 * Inline stock editor. Saves the difference from the number on screen as an
 * atomic adjustment, so a sale made while the shopkeeper was typing is never
 * undone; the row then shows the true live count.
 */
function StockInput({ product, variant, onSaved }) {
  const current = Number(variant ? variant.stock : product.stock) || 0;
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(String(current)), [current]);

  const dirty = value !== String(current);
  const parsed = Number(value);
  const valid = value !== '' && Number.isInteger(parsed) && parsed >= 0;

  const save = async () => {
    if (!dirty || !valid || saving) return;
    try {
      setSaving(true);
      const res = await vendorService.updateProductStock(product._id, {
        adjust: parsed - current,
        ...(variant ? { variantId: variant._id } : {}),
      });
      const updated = res.data;
      const live = variant ? updated.variants.find((v) => v._id === variant._id)?.stock : updated.stock;
      if (live !== parsed) {
        toast.success(`Saved — now ${live} (stock changed by an order while you were editing)`);
      } else {
        toast.success('Stock updated');
      }
      onSaved(updated);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <input
        type="number"
        min="0"
        step="1"
        className={`form-input${dirty && !valid ? ' form-input-error' : ''}`}
        style={{ width: 90, height: 34 }}
        value={value}
        disabled={saving}
        aria-label={variant ? `Stock for ${Object.values(variant.attributes || {}).join(' / ')}` : `Stock for ${product.title}`}
        onWheel={(e) => e.target.blur()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setValue(String(current));
        }}
      />
      {dirty && (
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!valid || saving} title="Save stock">
          {saving ? '…' : <Check size={14} />}
        </button>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchSummary = useCallback(async () => {
    try {
      const res = await vendorService.getStockSummary();
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getProducts({
        page,
        limit: 20,
        search: search || undefined,
        stock: tab || undefined,
        category: categoryFilter || undefined,
      });
      setProducts(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [page, search, tab, categoryFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => {
    vendorService.getCategories().then((res) => setCategories(res.data || [])).catch(() => {});
  }, []);

  const categoryPaths = useMemo(
    () => new Map(flattenCategoryTree(categories).map((c) => [String(c._id), c.path])),
    [categories]
  );

  // Keep the edited row in place (it may now fall outside the current tab
  // until the next refresh) and refresh the counters.
  const handleSaved = (updated) => {
    setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    fetchSummary();
  };

  const columns = [
    {
      key: 'title',
      label: 'Product',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {row.images?.[0] ? (
              <img src={row.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Package size={18} color="var(--gray-400)" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: 'var(--gray-900)' }}>{v}</strong>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
              {row.category ? categoryPaths.get(String(row.category._id)) || row.category.name : 'No category'}
              {row.size ? ` · ${row.size}` : ''}
            </div>
            {!row.isActive && <StatusBadge status="inactive" label="Hidden" size="sm" />}
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'Quantity in stock',
      render: (v, row) => {
        if (!row.variants?.length) return <StockInput product={row} onSaved={handleSaved} />;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {row.variants.map((variant) => (
              <div key={variant._id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span style={{ minWidth: 90, fontSize: 'var(--text-sm)', color: variant.isActive === false ? 'var(--gray-400)' : 'var(--gray-700)' }}>
                  {Object.values(variant.attributes || {}).join(' / ') || 'Option'}
                  {variant.isActive === false && ' (unavailable)'}
                </span>
                <StockInput product={row} variant={variant} onSaved={handleSaved} />
                {variant.isActive !== false && (
                  <StockBadge
                    stock={variant.stock}
                    out={variant.stock <= 0}
                    low={variant.stock > 0 && variant.stock <= LOW_STOCK_THRESHOLD}
                  />
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'totalStock',
      label: 'Status',
      width: 150,
      render: (v, row) => {
        const level = stockLevel(row);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <StockBadge {...level} />
            {row.variants?.length > 0 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{level.stock} in total</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Inventory"
        subtitle={`Check and update stock. Items at ${LOW_STOCK_THRESHOLD} or fewer count as low stock.`}
        breadcrumbs={[
          { label: 'Dashboard', to: '/vendor/dashboard' },
          { label: 'Inventory' },
        ]}
        actions={<Link className="btn btn-secondary" to="/vendor/products">Manage products</Link>}
      />

      <div className="grid grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatCard label="Products" value={summary?.total ?? '—'} icon={<Boxes size={20} />} />
        <StatCard label="Low stock" value={summary?.low ?? '—'} icon={<AlertTriangle size={20} />} color="var(--status-orange)" />
        <StatCard label="Out of stock" value={summary?.out ?? '—'} icon={<PackageX size={20} />} color="var(--status-red)" />
        <StatCard label="Hidden" value={summary?.hidden ?? '—'} icon={<EyeOff size={20} />} color="var(--color-text-muted)" />
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)', background: 'var(--gray-50)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }} role="tablist">
            {TABS.map(([key, label]) => (
              <button
                key={key || 'all'}
                role="tab"
                aria-selected={tab === key}
                className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setTab(key); setPage(1); }}
              >
                {label}
                {key === 'low' && summary ? ` (${summary.low})` : ''}
                {key === 'out' && summary ? ` (${summary.out})` : ''}
              </button>
            ))}
          </div>
          <select
            className="form-select"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{ height: 36, width: 'auto', maxWidth: 260 }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categoryOptions(categories).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
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
          onSearch={(v) => { setSearch(v); setPage(1); }}
          rowKey="_id"
          emptyIcon={<Boxes />}
          emptyTitle={tab === 'low' ? 'Nothing running low' : tab === 'out' ? 'Nothing out of stock' : 'No products'}
          emptyText={tab ? 'Everything here is well stocked.' : 'Add products on the Products page to manage their stock here.'}
        />
      </div>
    </div>
  );
}
