'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Plus, Settings, Trash2, Users } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useServerDataTableState } from '@hit/ui-kit';
import { useForms, useFormMutations } from '../hooks/useForms';
export function FormList({ onNavigate }) {
    const { Page, Card, Button, DataTable, Alert } = useUi();
    const serverTable = useServerDataTableState({
        tableId: 'forms',
        pageSize: 25,
        initialSort: { sortBy: 'updatedAt', sortOrder: 'desc' },
        sortWhitelist: ['name', 'slug', 'createdAt', 'updatedAt'],
    });
    // Admin mode: list ALL forms for management
    const { data, loading, error, refresh } = useForms({
        page: serverTable.query.page,
        pageSize: serverTable.query.pageSize,
        search: serverTable.query.search,
        sortBy: serverTable.query.sortBy,
        sortOrder: serverTable.query.sortOrder,
        adminMode: true,
    });
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
            updatedAt: f.updatedAt,
        }));
    }, [data]);
    const handleDelete = async (id, name) => {
        if (!confirm(`Delete form "${name}"? This will also delete its entries and ACLs.`))
            return;
        await deleteForm(id);
        refresh();
    };
    return (_jsxs(Page, { title: "Form Builder", description: "Build and manage form definitions. Use ACLs to control who can access each form.", actions: _jsxs(Button, { variant: "primary", onClick: () => navigate('/forms/new'), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "New Form"] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error loading forms", children: error.message })), _jsx(Card, { children: _jsx(DataTable, { columns: [
                        {
                            key: 'name',
                            label: 'Name',
                            sortable: true,
                            render: (_, row) => (_jsx("button", { className: "font-medium hover:text-blue-500 transition-colors text-left", onClick: () => navigate(`/forms/${row.id}`), children: row.name })),
                        },
                        { key: 'slug', label: 'Slug', sortable: true },
                        {
                            key: 'actions',
                            label: '',
                            align: 'right',
                            sortable: false,
                            hideable: false,
                            render: (_, row) => (_jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate(`/forms/${row.id}/entries`), children: _jsx(Users, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate(`/forms/${row.id}`), children: _jsx(Settings, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", disabled: mutating, onClick: () => handleDelete(row.id, row.name), children: _jsx(Trash2, { size: 16, className: "text-red-500" }) })] })),
                        },
                    ], data: rows, emptyMessage: "No forms yet. Create your first form to get started.", loading: loading, searchable: true, total: data?.pagination?.total, ...serverTable.dataTable, searchDebounceMs: 400, onRefresh: refresh, refreshing: loading, tableId: "forms" }) })] }));
}
export default FormList;
//# sourceMappingURL=FormList.js.map