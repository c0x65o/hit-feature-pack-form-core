'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeft, Edit, Trash2, ClipboardList, FileText } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useEntry, useForm, useEntryMutations } from '../hooks/useForms';
export function EntryDetail({ id, entryId, onNavigate }) {
    const { Page, Card, Button, Alert } = useUi();
    const formId = id;
    const { form, version } = useForm(formId);
    const { entry, loading, error } = useEntry(formId, entryId);
    const { deleteEntry, loading: deleting } = useEntryMutations(formId);
    const navigate = (path) => {
        if (!onNavigate)
            throw new Error('[forms] EntryDetail requires onNavigate for client-side navigation');
        onNavigate(path);
    };
    const fields = (version?.fields || [])
        .filter((f) => !f.hidden)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (loading) {
        return (_jsx(Page, { title: "Loading...", children: _jsx(Card, { children: _jsx("div", { className: "py-10", children: "Loading\u2026" }) }) }));
    }
    if (error || !entry) {
        return (_jsx(Page, { title: "Entry not found", actions: _jsxs(Button, { variant: "secondary", onClick: () => navigate(`/forms/${formId}/entries`), children: [_jsx(ArrowLeft, { size: 16, className: "mr-2" }), "Back"] }), children: _jsx(Alert, { variant: "error", title: "Error", children: error?.message || 'Entry not found' }) }));
    }
    const breadcrumbs = [
        { label: 'Forms', href: '/forms', icon: _jsx(ClipboardList, { size: 14 }) },
        ...(form ? [{ label: form.name, href: `/forms/${formId}`, icon: _jsx(FileText, { size: 14 }) }] : []),
        { label: 'Entries', href: `/forms/${formId}/entries` },
        { label: `Entry ${entry.id.slice(0, 8)}` },
    ];
    return (_jsx(Page, { title: form?.name || 'Entry', breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: "primary", onClick: () => navigate(`/forms/${formId}/entries/${entry.id}/edit`), children: [_jsx(Edit, { size: 16, className: "mr-2" }), "Edit"] }), _jsxs(Button, { variant: "danger", onClick: async () => {
                        if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.'))
                            return;
                        try {
                            await deleteEntry(entry.id);
                            navigate(`/forms/${formId}/entries`);
                        }
                        catch (err) {
                            // Error handling is done by the hook
                        }
                    }, disabled: deleting, children: [_jsx(Trash2, { size: 16, className: "mr-2" }), deleting ? 'Deleting...' : 'Delete'] })] }), children: _jsx(Card, { children: _jsx("div", { className: "space-y-4", children: fields.map((f) => {
                    const v = (entry.data || {})[f.key];
                    const isRef = f.type === 'reference';
                    const isEntityRef = f.type === 'entity_reference';
                    const isUrl = f.type === 'url';
                    const isDate = f.type === 'date';
                    const isDateTime = f.type === 'datetime';
                    return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-500", children: f.label }), _jsx("div", { className: "text-base", children: v === undefined || v === null ? ('') : isUrl ? (_jsx("a", { className: "text-sm hover:text-blue-500 underline", href: String(v), target: "_blank", rel: "noreferrer", children: String(v) })) : isDate || isDateTime ? ((() => {
                                    try {
                                        const date = new Date(String(v));
                                        if (!isNaN(date.getTime())) {
                                            return isDateTime
                                                ? date.toLocaleString()
                                                : date.toLocaleDateString();
                                        }
                                    }
                                    catch {
                                        // Fall through to string display
                                    }
                                    return String(v);
                                })()) : isRef ? (Array.isArray(v) ? (_jsx("div", { className: "flex flex-wrap gap-2", children: v.map((r, idx) => (_jsx("a", { className: "text-sm hover:text-blue-500 underline", href: `/forms/${r?.formId || ''}/entries/${r?.entryId || ''}`, onClick: (e) => {
                                            e.preventDefault();
                                            if (r?.formId && r?.entryId) {
                                                navigate(`/forms/${r.formId}/entries/${r.entryId}`);
                                            }
                                        }, children: r?.label || r?.entryId || 'Reference' }, `${r?.entryId || idx}-${idx}`))) })) : typeof v === 'object' ? (_jsx("a", { className: "text-sm hover:text-blue-500 underline", href: `/forms/${v.formId}/entries/${v.entryId}`, onClick: (e) => {
                                        e.preventDefault();
                                        if (v.formId && v.entryId) {
                                            navigate(`/forms/${v.formId}/entries/${v.entryId}`);
                                        }
                                    }, children: v.label || v.entryId })) : (String(v))) : isEntityRef ? (Array.isArray(v) ? (_jsx("div", { className: "flex flex-wrap gap-2", children: v.map((r, idx) => (String(r?.entityKind || '') === 'project' && r?.entityId ? (_jsx("a", { className: "text-sm hover:text-blue-500 underline", href: `/marketing/projects/${encodeURIComponent(String(r.entityId))}`, onClick: (e) => {
                                            e.preventDefault();
                                            navigate(`/marketing/projects/${encodeURIComponent(String(r.entityId))}`);
                                        }, children: r?.label || r?.entityId || 'Project' }, `${r?.entityId || idx}-${idx}`)) : (_jsx("span", { className: "text-sm", children: r?.label || r?.entityId || 'Entity' }, `${r?.entityId || idx}-${idx}`)))) })) : typeof v === 'object' ? (String(v?.entityKind || '') === 'project' && v?.entityId ? (_jsx("a", { className: "text-sm hover:text-blue-500 underline", href: `/marketing/projects/${encodeURIComponent(String(v.entityId))}`, onClick: (e) => {
                                        e.preventDefault();
                                        navigate(`/marketing/projects/${encodeURIComponent(String(v.entityId))}`);
                                    }, children: v.label || v.entityId })) : (_jsx("span", { className: "text-sm", children: v.label || v.entityId }))) : (String(v))) : (String(v)) })] }, f.key));
                }) }) }) }));
}
export default EntryDetail;
//# sourceMappingURL=EntryDetail.js.map