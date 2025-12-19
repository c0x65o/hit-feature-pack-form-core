'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useForms, useFormMutations } from '../hooks/useForms';
export function FormList({ onNavigate }) {
    const { Page, Card, Button, DataTable, Alert } = useUi();
    const [page, setPage] = useState(1);
    const { data, loading, error, refresh } = useForms({ page, pageSize: 25 });
    const { deleteForm, loading: mutating } = useFormMutations();
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const rows = useMemo(() => {
        return (data?.items || []).map((f) => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            isPublished: f.isPublished,
            updatedAt: f.updatedAt,
        }));
    }, [data]);
    const handleDelete = async (id, name) => {
        if (!confirm(`Delete form "${name}"? This will also delete its entries.`))
            return;
        await deleteForm(id);
        refresh();
    };
    return (_jsxs(Page, { title: "Forms", description: "Build and manage runtime forms", actions: _jsxs(Button, { variant: "primary", onClick: () => navigate('/forms/new'), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "New Form"] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error loading forms", children: error.message })), _jsx(Card, { children: _jsx(DataTable, { columns: [
                        {
                            key: 'name',
                            label: 'Name',
                            sortable: true,
                            render: (_, row) => (_jsx("button", { className: "font-medium hover:text-blue-500 transition-colors text-left", onClick: () => navigate(`/forms/${row.id}`), children: row.name })),
                        },
                        { key: 'slug', label: 'Slug', sortable: true },
                        {
                            key: 'isPublished',
                            label: 'Published',
                            sortable: true,
                            render: (v) => (v ? 'Yes' : 'No'),
                        },
                        {
                            key: 'actions',
                            label: '',
                            align: 'right',
                            sortable: false,
                            hideable: false,
                            render: (_, row) => (_jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate(`/forms/${row.id}`), children: _jsx(Settings, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", disabled: mutating, onClick: () => handleDelete(row.id, row.name), children: _jsx(Trash2, { size: 16, className: "text-red-500" }) })] })),
                        },
                    ], data: rows, emptyMessage: "No forms yet", loading: loading, searchable: true, pageSize: 25 }) })] }));
}
export default FormList;
//# sourceMappingURL=FormList.js.map