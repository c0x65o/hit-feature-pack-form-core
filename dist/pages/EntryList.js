'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useEntries, useForm, useEntryMutations } from '../hooks/useForms';
export function EntryList({ id, onNavigate }) {
    const { Page, Card, Button, DataTable, Alert } = useUi();
    const formId = id;
    const [page, setPage] = useState(1);
    const { form, version } = useForm(formId);
    const { data, loading, error, refresh } = useEntries({ formId, page, pageSize: 25 });
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
    const columns = useMemo(() => {
        const dynamicCols = visibleFields.map((f) => ({
            key: f.key,
            label: f.label,
            sortable: false,
            render: (_, row) => {
                const v = row.data?.[f.key];
                if (v === undefined || v === null)
                    return '';
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
        }));
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
    }, [visibleFields, formId, navigate, deleteEntry, refresh, mutating]);
    const rows = useMemo(() => {
        return (data?.items || []).map((e) => ({
            id: e.id,
            data: e.data,
            updatedAt: e.updatedAt,
        }));
    }, [data]);
    return (_jsxs(Page, { title: form?.name || '', description: form?.scope === 'private' ? 'Private entries (owner-only)' : 'Project entries', actions: _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "primary", onClick: () => navigate(`/forms/${formId}/entries/new`), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "New Entry"] }) }), children: [error && (_jsx(Alert, { variant: "error", title: "Error loading entries", children: error.message })), _jsx(Card, { children: _jsx(DataTable, { columns: columns, data: rows, emptyMessage: "No entries yet", loading: loading, searchable: true, pageSize: 25, onRowClick: (row) => navigate(`/forms/${formId}/entries/${row.id}`) }) })] }));
}
export default EntryList;
//# sourceMappingURL=EntryList.js.map