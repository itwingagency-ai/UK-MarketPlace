import { useState, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import Pagination from './Pagination';

/**
 * <DataTable> — sortable, paginated, searchable, bulk-selectable table.
 *
 * Props:
 *   columns      – [{ key, label, sortable?, render?, width? }]
 *   data         – Array of row objects
 *   loading      – Boolean
 *   totalItems   – Total count (for server-side pagination)
 *   page         – Current page (1-indexed)
 *   pageSize     – Items per page
 *   onPageChange – (page) => void
 *   onSort       – (key, direction) => void  (server-side sorting)
 *   searchable   – Boolean (show search bar)
 *   onSearch     – (query) => void
 *   searchValue  – controlled search value
 *   selectable   – Boolean (show checkboxes)
 *   selectedIds  – Set of selected row IDs
 *   onSelect     – (id, checked) => void
 *   onSelectAll  – (checked) => void
 *   rowKey       – string (field to use as unique id, default '_id')
 *   emptyIcon    – ReactNode
 *   emptyTitle   – string
 *   emptyText    – string
 *   actions      – (row) => ReactNode  (action buttons per row)
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  totalItems = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onSort,
  searchable = false,
  onSearch,
  searchValue = '',
  selectable = false,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  rowKey = '_id',
  emptyIcon,
  emptyTitle = 'No Data',
  emptyText = 'There are no records to display.',
  actions,
}) {
  const [localSort, setLocalSort] = useState({ key: null, dir: 'asc' });

  const handleSort = useCallback(
    (key) => {
      const nextDir = localSort.key === key && localSort.dir === 'asc' ? 'desc' : 'asc';
      setLocalSort({ key, dir: nextDir });
      if (onSort) onSort(key, nextDir);
    },
    [localSort, onSort]
  );

  const sortedData = useMemo(() => {
    if (onSort || !localSort.key) return data; // server-side or no sort
    const sorted = [...data].sort((a, b) => {
      const aVal = a[localSort.key] ?? '';
      const bVal = b[localSort.key] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return localSort.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return localSort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [data, localSort, onSort]);

  const allChecked = data.length > 0 && data.every((r) => selectedIds.has(r[rowKey]));

  const renderSortIcon = (col) => {
    if (!col.sortable) return null;
    if (localSort.key === col.key) {
      return localSort.dir === 'asc' ? (
        <ChevronUp size={12} />
      ) : (
        <ChevronDown size={12} />
      );
    }
    return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />;
  };

  return (
    <div className="data-table-container">
      {searchable && (
        <div className="data-table-search">
          <div className="search-input-wrapper">
            <Search size={14} />
            <input
              type="text"
              className="form-input"
              placeholder="Search…"
              value={searchValue}
              onChange={(e) => onSearch?.(e.target.value)}
              id="data-table-search"
            />
          </div>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: col.sortable ? 'none' : 'auto',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {renderSortIcon(col)}
                  </span>
                </th>
              ))}
              {actions && <th style={{ textAlign: 'right', width: 120 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  style={{ textAlign: 'center', padding: 'var(--space-8)' }}
                >
                  <div className="loading-overlay">
                    <div className="spinner" />
                    <p>Loading…</p>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}>
                  <div className="empty-state">
                    {emptyIcon && <div className="empty-state-icon">{emptyIcon}</div>}
                    <h3>{emptyTitle}</h3>
                    <p>{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr key={row[rowKey]}>
                  {selectable && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row[rowKey])}
                        onChange={(e) => onSelect?.(row[rowKey], e.target.checked)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td style={{ textAlign: 'right' }}>{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalItems > pageSize && (
        <Pagination
          currentPage={page}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
