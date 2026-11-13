import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminService } from '../../api/adminService';
import { PageHeader, Modal, StatusBadge } from '../../components/common';
import {
  FolderTree, Plus, ArrowUp, ArrowDown, Trash2, Check, Sparkles, CornerDownRight, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Accent tokens (server enum) → design-token palette (styles/tokens.css)
const ACCENTS = {
  groceriesMint: { label: 'Mint', css: 'mint' },
  bakeryAmber: { label: 'Amber', css: 'amber' },
  dairySky: { label: 'Sky', css: 'sky' },
  meatCoral: { label: 'Coral', css: 'coral' },
  drinksViolet: { label: 'Violet', css: 'violet' },
  pharmacyTeal: { label: 'Teal', css: 'teal' },
  frozenCyan: { label: 'Cyan', css: 'cyan' },
  householdIndigo: { label: 'Indigo', css: 'indigo' },
};

const iconUrl = (key) => (key ? `/3d/${key}.png` : '');
const iconLabel = (key) => key.replace(/^cat-/, '').replace(/-/g, ' ');

const EMPTY = {
  name: '',
  slug: '',
  parent: '',
  description: '',
  iconKey: 'cat-fruit-veg',
  accentColor: 'groceriesMint',
  isActive: true,
  isFeatured: false,
  keywords: '',
  seoTitle: '',
  seoDescription: '',
};

const toForm = (cat) => ({
  name: cat.name,
  slug: cat.slug,
  parent: cat.parent || '',
  description: cat.description || '',
  iconKey: cat.icon3d?.assetKey || 'cat-fruit-veg',
  accentColor: cat.accentColor || 'groceriesMint',
  isActive: cat.isActive,
  isFeatured: cat.isFeatured,
  keywords: (cat.keywords || []).join(', '),
  seoTitle: cat.seo?.title || '',
  seoDescription: cat.seo?.description || '',
});

function CategoryTile({ name, iconKey, accentColor, size = 'md' }) {
  const css = ACCENTS[accentColor]?.css || 'mint';
  const dim = size === 'sm' ? 36 : 96;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: size === 'sm' ? 10 : 24,
          background: `var(--color-cat-${css}-bg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {iconKey && <img src={iconUrl(iconKey)} alt="" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />}
      </div>
      {size !== 'sm' && (
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: `var(--color-cat-${css}-fg)`, textAlign: 'center', maxWidth: 120 }}>
          {name || 'Category name'}
        </span>
      )}
    </div>
  );
}

export default function CategoryStudioPage() {
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ iconKeys: [], accentColors: [], unmappedStoreCategories: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null); // null = nothing, 'new' = creating
  const [form, setForm] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [replacement, setReplacement] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminService.getGlobalCategories();
      setCategories(res.data || []);
      setMeta(res.meta || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = categories.find((c) => c.id === selectedId) || null;
  const roots = useMemo(() => categories.filter((c) => !c.parent), [categories]);
  const childrenOf = useCallback((id) => categories.filter((c) => c.parent === id), [categories]);

  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');

  const select = (cat) => {
    if (!confirmDiscard()) return;
    setSelectedId(cat.id);
    setForm(toForm(cat));
    setDirty(false);
  };

  const startNew = (parentId = '') => {
    if (!confirmDiscard()) return;
    setSelectedId('new');
    setForm({ ...EMPTY, parent: parentId });
    setDirty(false);
  };

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const save = async () => {
    if (form.name.trim().length < 2 || form.name.trim().length > 60) {
      toast.error('Enter a category name between 2 and 60 characters.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      parent: form.parent || null,
      description: form.description,
      iconKey: form.iconKey,
      accentColor: form.accentColor,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      keywords: form.keywords,
      seo: { title: form.seoTitle, description: form.seoDescription },
      ...(form.slug.trim() && { slug: form.slug.trim().toLowerCase() }),
    };
    setSaving(true);
    try {
      if (selectedId === 'new') {
        const res = await adminService.createGlobalCategory(payload);
        toast.success('Category created');
        setSelectedId(res.data.id);
        setForm(toForm(res.data));
      } else {
        const res = await adminService.updateGlobalCategory(selectedId, payload);
        toast.success('Changes saved');
        setForm(toForm(res.data));
      }
      setDirty(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Swap a category with its neighbour among siblings, then save the order
  const move = async (cat, direction) => {
    const siblings = cat.parent ? childrenOf(cat.parent) : roots;
    const index = siblings.findIndex((c) => c.id === cat.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const items = reordered.map((c, i) => ({ id: c.id, sortOrder: i }));

    // Optimistic: apply locally so the row moves at once
    const orderMap = new Map(items.map((i) => [i.id, i.sortOrder]));
    setCategories((prev) => {
      const next = prev.map((c) => (orderMap.has(c.id) ? { ...c, sortOrder: orderMap.get(c.id) } : c));
      const bySort = (a, b) => a.sortOrder - b.sortOrder;
      const r = next.filter((c) => !c.parent).sort(bySort);
      return r.flatMap((root) => [root, ...next.filter((c) => c.parent === root.id).sort(bySort)]);
    });
    try {
      await adminService.reorderGlobalCategories(items);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the new order');
      load();
    }
  };

  const openDelete = () => {
    setReplacement('');
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      const res = await adminService.deleteGlobalCategory(selected.id, replacement || undefined);
      toast.success(res.message || 'Category deleted');
      setDeleteOpen(false);
      setSelectedId(null);
      setDirty(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (cat, siblings, index) => (
    <li key={cat.id}>
      <div
        className={`studio-row${selectedId === cat.id ? ' is-selected' : ''}`}
        style={{ paddingLeft: cat.parent ? 'var(--space-8)' : 'var(--space-3)' }}
      >
        <button type="button" className="studio-row-main" onClick={() => select(cat)} aria-current={selectedId === cat.id}>
          {cat.parent && <CornerDownRight size={14} color="var(--gray-400)" />}
          <CategoryTile size="sm" iconKey={cat.icon3d?.assetKey} accentColor={cat.accentColor} />
          <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <strong style={{ display: 'block', color: cat.isActive ? 'var(--gray-900)' : 'var(--gray-400)' }}>{cat.name}</strong>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
              {cat.storeCount} store{cat.storeCount === 1 ? '' : 's'} · {cat.productCount} product{cat.productCount === 1 ? '' : 's'}
            </span>
          </span>
          {cat.isFeatured && <Sparkles size={14} color="var(--color-cat-amber-accent)" aria-label="Featured" />}
          {!cat.isActive && <StatusBadge status="inactive" label="Hidden" />}
        </button>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(cat, -1)} disabled={index === 0} aria-label={`Move ${cat.name} up`}>
            <ArrowUp size={14} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(cat, 1)} disabled={index === siblings.length - 1} aria-label={`Move ${cat.name} down`}>
            <ArrowDown size={14} />
          </button>
        </div>
      </div>
    </li>
  );

  const editing = selectedId !== null;
  const parentOptions = roots.filter((r) => r.id !== selectedId);
  const selectedHasChildren = selected ? childrenOf(selected.id).length > 0 : false;
  const replacementOptions = categories.filter((c) => c.id !== selected?.id);
  const needsReplacement = (selected?.storeCategoryCount || 0) > 0;
  const deleteBlocked = selectedHasChildren;

  return (
    <div className="page-content animate-fade-in">
      <PageHeader
        title="Category Studio"
        subtitle="Marketplace categories customers browse in the app. Every store aisle maps to one."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Category Studio' }]}
        actions={
          <button className="btn btn-primary" onClick={() => startNew()}>
            <Plus size={16} /> New category
          </button>
        }
      />

      {meta.unmappedStoreCategories > 0 && (
        <div className="card" role="status" style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderLeft: '4px solid var(--warning-text)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--text-sm)' }}>
            {meta.unmappedStoreCategories} store categor{meta.unmappedStoreCategories === 1 ? 'y is' : 'ies are'} not mapped yet.
            Vendors see a reminder on their Categories page.
          </span>
        </div>
      )}

      <div className="studio-grid">
        {/* Tree */}
        <section className="card" aria-label="Category tree">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FolderTree size={16} /> Categories</h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>Order here = order in the app</span>
          </div>
          {loading ? (
            <div className="card-body" style={{ color: 'var(--gray-500)' }}>Loading…</div>
          ) : categories.length === 0 ? (
            <div className="card-body" style={{ color: 'var(--gray-500)' }}>
              No categories yet. Run <code>node seed-global-categories.js</code> on the server for the 24 defaults, or create one.
            </div>
          ) : (
            <ul className="studio-tree">
              {roots.map((root, i) => (
                <li key={root.id}>
                  <ul className="studio-tree">
                    {renderRow(root, roots, i)}
                    {childrenOf(root.id).map((child, ci, arr) => renderRow(child, arr, ci))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Inspector */}
        <section className="card" aria-label="Category details">
          {!editing ? (
            <div className="card-body" style={{ color: 'var(--gray-500)', textAlign: 'center', padding: 'var(--space-10) var(--space-5)' }}>
              Select a category to edit it, or create a new one.
            </div>
          ) : (
            <>
              <div className="card-header">
                <h3>{selectedId === 'new' ? 'New category' : form.name || 'Edit category'}</h3>
                {selected && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                    {selected.storeCategoryCount} store aisle{selected.storeCategoryCount === 1 ? '' : 's'} mapped
                  </span>
                )}
              </div>
              <div className="card-body studio-inspector">
                <div className="studio-preview" aria-label="Preview as shown in the app">
                  <CategoryTile name={form.name} iconKey={form.iconKey} accentColor={form.accentColor} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>App preview</span>
                </div>

                <div className="studio-fields">
                  <label className="form-label" htmlFor="gc-name">Name<span className="form-required">*</span></label>
                  <input id="gc-name" className="form-input" value={form.name} maxLength={60} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Bakery" />

                  <label className="form-label" htmlFor="gc-slug">Web address</label>
                  <input id="gc-slug" className="form-input" value={form.slug} maxLength={60} onChange={(e) => update('slug', e.target.value)} placeholder="Made from the name if left blank" />

                  <label className="form-label" htmlFor="gc-parent">Inside</label>
                  <select
                    id="gc-parent"
                    className="form-input"
                    value={form.parent}
                    onChange={(e) => update('parent', e.target.value)}
                    disabled={selectedHasChildren}
                  >
                    <option value="">None — top-level category</option>
                    {parentOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {selectedHasChildren && <span className="form-help">Has sub-categories, so it stays top-level.</span>}

                  <label className="form-label" htmlFor="gc-desc">Description</label>
                  <textarea id="gc-desc" className="form-input" rows={2} maxLength={300} value={form.description} onChange={(e) => update('description', e.target.value)} />
                </div>
              </div>

              <div className="card-body" style={{ borderTop: '1px solid var(--gray-200)' }}>
                <span className="form-label" id="gc-icon-label">3D icon</span>
                <div className="studio-icons" role="radiogroup" aria-labelledby="gc-icon-label">
                  {(meta.iconKeys || []).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={form.iconKey === key}
                      title={iconLabel(key)}
                      className={`studio-icon${form.iconKey === key ? ' is-selected' : ''}`}
                      onClick={() => update('iconKey', key)}
                    >
                      <img src={iconUrl(key)} alt={iconLabel(key)} />
                    </button>
                  ))}
                </div>

                <span className="form-label" id="gc-accent-label" style={{ marginTop: 'var(--space-4)', display: 'block' }}>Accent colour</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-labelledby="gc-accent-label">
                  {(meta.accentColors || Object.keys(ACCENTS)).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={form.accentColor === key}
                      title={ACCENTS[key]?.label || key}
                      onClick={() => update('accentColor', key)}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                        background: `var(--color-cat-${ACCENTS[key]?.css}-accent, var(--color-cat-${ACCENTS[key]?.css}-fg))`,
                        border: form.accentColor === key ? '3px solid var(--gray-900)' : '3px solid transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                      }}
                    >
                      {form.accentColor === key && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card-body studio-fields" style={{ borderTop: '1px solid var(--gray-200)' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
                  Visible in the app
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => update('isFeatured', e.target.checked)} disabled={Boolean(form.parent)} />
                  Featured on the app home screen {form.parent && '(top-level only)'}
                </label>

                <label className="form-label" htmlFor="gc-keywords">Search keywords</label>
                <input id="gc-keywords" className="form-input" value={form.keywords} onChange={(e) => update('keywords', e.target.value)} placeholder="bread, cakes, pastries" />
                <span className="form-help">Comma-separated. Also used to auto-map store aisles.</span>

                <label className="form-label" htmlFor="gc-seo-title">SEO title</label>
                <input id="gc-seo-title" className="form-input" maxLength={70} value={form.seoTitle} onChange={(e) => update('seoTitle', e.target.value)} />
                <label className="form-label" htmlFor="gc-seo-desc">SEO description</label>
                <textarea id="gc-seo-desc" className="form-input" rows={2} maxLength={160} value={form.seoDescription} onChange={(e) => update('seoDescription', e.target.value)} />
              </div>

              <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                {selected ? (
                  <button className="btn btn-ghost" style={{ color: 'var(--danger-text)' }} onClick={openDelete} disabled={saving}>
                    <Trash2 size={14} /> Delete
                  </button>
                ) : <span />}
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedId !== 'new' && !selected?.parent && (
                    <button className="btn btn-ghost" onClick={() => startNew(selected.id)} disabled={saving}>
                      <Plus size={14} /> Sub-category
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={save} disabled={saving || (!dirty && selectedId !== 'new')}>
                    {saving ? 'Saving…' : selectedId === 'new' ? 'Create category' : 'Save changes'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => !saving && setDeleteOpen(false)}
        title="Delete category"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</button>
            {!deleteBlocked && (
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={saving || (needsReplacement && !replacement)}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </>
        }
      >
        {deleteBlocked ? (
          <p><strong>{selected?.name}</strong> has sub-categories. Move or delete them first.</p>
        ) : needsReplacement ? (
          <>
            <p>
              <strong>{selected?.name}</strong> has {selected.storeCategoryCount} store aisle{selected.storeCategoryCount === 1 ? '' : 's'} and{' '}
              {selected.productCount} product{selected.productCount === 1 ? '' : 's'} mapped to it. Choose a replacement category before deleting.
            </p>
            <label className="form-label" htmlFor="gc-replacement" style={{ marginTop: 'var(--space-3)', display: 'block' }}>Move them to</label>
            <select id="gc-replacement" className="form-input" value={replacement} onChange={(e) => setReplacement(e.target.value)}>
              <option value="">Choose a category…</option>
              {replacementOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.parent ? `— ${c.name}` : c.name}</option>
              ))}
            </select>
          </>
        ) : (
          <p>Delete <strong>{selected?.name}</strong>? Nothing is mapped to it. This can’t be undone.</p>
        )}
      </Modal>
    </div>
  );
}
