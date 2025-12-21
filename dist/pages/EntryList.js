'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useEntries, useForm, useEntryMutations } from '../hooks/useForms';
export function EntryList({ id, onNavigate }) {
    const { Page, Card, Button, DataTable, Alert } = useUi();
    const formId = id;
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sortBy, setSortBy] = useState('updatedAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [activeFilters, setActiveFilters] = useState([]);
    const { form, version } = useForm(formId);
    const { data, loading, error, refresh } = useEntries({ formId, page, pageSize, sortBy, sortOrder });
    const { deleteEntry, loading: mutating } = useEntryMutations(formId);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const visibleFields = (version?.fields || [])
        .filter((f) => !f.hidden && (f.showInTable !== false))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, 10); // increased limit since we have explicit control
    // Handle view filter changes
    const handleViewFiltersChange = useCallback((filters) => {
        setActiveFilters(filters);
        // TODO: Apply filters to data fetching when server-side filtering is implemented
    }, []);
    // Handle sorting changes from view system
    const handleViewSortingChange = useCallback((sorting) => {
        if (sorting.length > 0) {
            const firstSort = sorting[0];
            setSortBy(firstSort.id);
            setSortOrder(firstSort.desc ? 'desc' : 'asc');
            setPage(1); // Reset to first page when sorting changes
        }
        else {
            // Default sort
            setSortBy('updatedAt');
            setSortOrder('desc');
        }
    }, []);
    const parseSelectOptions = useCallback((f) => {
        // Support both optionsText (from seed files) and options array (from form builder)
        if (f.config?.optionsText) {
            const text = String(f.config.optionsText).trim();
            if (!text)
                return [];
            return text
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                const [value, label] = line.split('|');
                return { value: (value || '').trim(), label: (label || value || '').trim() };
            })
                .filter((o) => o.value);
        }
        // Fallback to options array format
        return (f.config?.options || []).map((opt) => ({
            value: typeof opt === 'string' ? opt : opt.value,
            label: typeof opt === 'string' ? opt : opt.label,
        }));
    }, []);
    const columns = useMemo(() => {
        const dynamicCols = visibleFields.map((f) => {
            // Map form field types to DataTable filter types
            let filterType = 'string';
            let filterOptions;
            switch (f.type) {
                case 'number':
                    filterType = 'number';
                    break;
                case 'date':
                case 'datetime':
                    filterType = 'date';
                    break;
                case 'checkbox':
                    filterType = 'boolean';
                    break;
                case 'select':
                    filterType = 'select';
                    filterOptions = parseSelectOptions(f);
                    break;
            }
            // Enable sorting for all field types - DataTable will sort by the rendered value
            return {
                key: f.key,
                label: f.label,
                sortable: true, // Enable sorting for all columns
                filterType,
                filterOptions,
                render: (_, row) => {
                    // Form fields are flattened onto the row (e.g., row.platform) for sorting/grouping.
                    // Keep the original raw form data around for label lookups/rendering.
                    const raw = row?._formData || row?.data || {};
                    const v = raw?.[f.key];
                    if (v === undefined || v === null)
                        return '';
                    // Select fields should display the option label, not the stored value/key
                    if (f.type === 'select' && filterOptions?.length) {
                        const optionMap = new Map(filterOptions.map((o) => [String(o.value), String(o.label)]));
                        if (Array.isArray(v)) {
                            return v.map((x) => optionMap.get(String(x)) || String(x)).join(', ');
                        }
                        return optionMap.get(String(v)) || String(v);
                    }
                    if (f.type === 'url') {
                        const s = String(v);
                        if (!s.trim())
                            return '';
                        return (_jsx("a", { className: "text-sm hover:text-blue-500 underline", href: s, target: "_blank", rel: "noreferrer", children: s }));
                    }
                    if (f.type === 'datetime' || f.type === 'date') {
                        try {
                            const date = new Date(String(v));
                            if (!isNaN(date.getTime())) {
                                return f.type === 'datetime'
                                    ? date.toLocaleString()
                                    : date.toLocaleDateString();
                            }
                        }
                        catch {
                            // Fall through to string display
                        }
                    }
                    // Friendly display for reference fields
                    if (Array.isArray(v)) {
                        return v
                            .map((x) => x?.label || x?.entryId || x?.entityId || '')
                            .filter(Boolean)
                            .join(', ');
                    }
                    if (typeof v === 'object') {
                        return v.label || v.entryId || v.entityId || '';
                    }
                    return String(v);
                },
            };
        });
        return [
            ...dynamicCols,
            {
                key: 'updatedAt',
                label: 'Updated',
                sortable: true,
                render: (v) => (v ? new Date(String(v)).toLocaleString() : ''),
            },
            {
                key: 'actions',
                label: '',
                align: 'right',
                sortable: false,
                hideable: false,
                render: (_, row) => (_jsxs("div", { className: "flex items-center justify-end gap-2", onClick: (e) => e.stopPropagation(), children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                                e.stopPropagation();
                                navigate(`/forms/${formId}/entries/${row.id}/edit`);
                            }, children: _jsx(Edit, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", disabled: mutating, onClick: async (e) => {
                                e.stopPropagation();
                                if (!confirm('Delete this entry?'))
                                    return;
                                await deleteEntry(row.id);
                                refresh();
                            }, children: _jsx(Trash2, { size: 16, className: "text-red-500" }) })] })),
            },
        ];
    }, [visibleFields, formId, navigate, deleteEntry, refresh, mutating, parseSelectOptions]);
    const rows = useMemo(() => {
        // Flatten form data onto the row so grouping and column access work correctly.
        // Form fields become top-level properties (e.g., row.platform instead of row.data.platform)
        return (data?.items || []).map((e) => ({
            id: e.id,
            ...e.data, // Spread form fields onto row for grouping/sorting
            _formData: e.data, // Keep original data for reference if needed
            updatedAt: e.updatedAt,
        }));
    }, [data]);
    return (_jsxs(Page, { title: form?.name || '', description: "Form entries", actions: _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "primary", onClick: () => navigate(`/forms/${formId}/entries/new`), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "New Entry"] }) }), children: [error && (_jsx(Alert, { variant: "error", title: "Error loading entries", children: error.message })), _jsx(Card, { children: _jsx(DataTable, { columns: columns, data: rows, emptyMessage: "No entries yet", loading: loading, searchable: true, pageSize: pageSize, page: page, total: data?.pagination.total, onPageChange: (newPage) => {
                        setPage(newPage);
                    }, manualPagination: true, initialSorting: [{ id: sortBy, desc: sortOrder === 'desc' }], pageSizeOptions: [10, 25, 50, 100], onPageSizeChange: (newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }, onRowClick: (row) => navigate(`/forms/${formId}/entries/${row.id}`), tableId: `form.${formId}`, enableViews: true, onViewFiltersChange: handleViewFiltersChange, onViewSortingChange: handleViewSortingChange, onRefresh: refresh, refreshing: loading }) })] }));
}
export default EntryList;
//# sourceMappingURL=EntryList.js.map