'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save, ClipboardList, FileText, Share2, Eye, Star, Trash2, Edit2 } from 'lucide-react';
import { useUi, useTableView } from '@hit/ui-kit';
import { useForms, useForm, useFormMutations, } from '../hooks/useForms';
import { FormAclModal } from '../components/FormAclModal';
function slugify(input) {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
export function FormBuilder({ id, onNavigate }) {
    const { Page, Card, Button, Input, TextArea, Select, Alert } = useUi();
    const isNew = !id || id === 'new';
    const { form, version, loading: loadingForm, error: loadError, refresh } = useForm(isNew ? undefined : id);
    const { createForm, saveForm, loading: saving, error: saveError } = useFormMutations();
    const { data: allForms } = useForms({ page: 1, pageSize: 200 });
    // Table views for entries list
    const tableId = id && !isNew ? `form.${id}` : '';
    const { views, loading: viewsLoading, available: viewsAvailable, createView, updateView, deleteView, refresh: refreshViews, } = useTableView({ tableId });
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    // Nav config
    const [navShow, setNavShow] = useState(true);
    const [navPlacement, setNavPlacement] = useState('under_forms');
    const [navGroup, setNavGroup] = useState('main');
    const [navWeight, setNavWeight] = useState(500);
    const [navLabel, setNavLabel] = useState('');
    const [navIcon, setNavIcon] = useState('');
    const [navParentPath, setNavParentPath] = useState('');
    const [availableNavPaths, setAvailableNavPaths] = useState([]);
    const [fields, setFields] = useState([]);
    const [localError, setLocalError] = useState(null);
    const [showAclModal, setShowAclModal] = useState(false);
    // Views configuration - for managing list views
    const [showViewBuilder, setShowViewBuilder] = useState(false);
    const [editingView, setEditingView] = useState(null);
    const [viewBuilderName, setViewBuilderName] = useState('');
    const [viewBuilderDescription, setViewBuilderDescription] = useState('');
    const [viewBuilderFilters, setViewBuilderFilters] = useState([]);
    const [viewBuilderIsDefault, setViewBuilderIsDefault] = useState(false);
    const [viewBuilderSaving, setViewBuilderSaving] = useState(false);
    // Fetch available nav paths for tree picker
    useEffect(() => {
        async function loadNavPaths() {
            try {
                const res = await fetch('/api/nav-tree');
                if (res.ok) {
                    const data = await res.json();
                    setAvailableNavPaths(data.paths || []);
                }
            }
            catch {
                // Nav tree API not available, use static fallback
                setAvailableNavPaths([
                    { path: '/marketing', label: 'Marketing', depth: 0 },
                    { path: '/marketing/projects', label: 'Marketing → Projects', depth: 1 },
                    { path: '/marketing/setup', label: 'Marketing → Setup', depth: 1 },
                    { path: '/music', label: 'Music', depth: 0 },
                ]);
            }
        }
        loadNavPaths();
    }, []);
    useEffect(() => {
        if (form) {
            setName(form.name);
            setSlug(form.slug);
            setDescription(form.description || '');
            setNavShow(form.navShow ?? true);
            // Determine placement from navParentPath
            if (form.navParentPath) {
                setNavPlacement('custom');
                setNavParentPath(form.navParentPath);
            }
            else if (form.navPlacement === 'top_level') {
                setNavPlacement('top_level');
            }
            else {
                setNavPlacement('under_forms');
            }
            setNavGroup(form.navGroup || 'main');
            setNavWeight(typeof form.navWeight === 'number' ? form.navWeight : 500);
            setNavLabel(form.navLabel || '');
            setNavIcon(form.navIcon || '');
        }
        if (version?.fields) {
            const sorted = [...version.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setFields(sorted);
        }
    }, [form, version]);
    const addField = () => {
        const nextOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order || 0)) + 10 : 10;
        setFields((prev) => [
            ...prev,
            {
                id: `tmp_${Math.random().toString(16).slice(2)}`,
                key: `field_${prev.length + 1}`,
                label: `Field ${prev.length + 1}`,
                type: 'text',
                order: nextOrder,
                required: false,
                hidden: false,
                config: {},
                defaultValue: null,
            },
        ]);
    };
    const moveField = (idx, dir) => {
        const next = [...fields];
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= next.length)
            return;
        const a = next[idx];
        const b = next[swapIdx];
        next[idx] = b;
        next[swapIdx] = a;
        // normalize order
        next.forEach((f, i) => (f.order = (i + 1) * 10));
        setFields(next);
    };
    const removeField = (idx) => {
        const next = [...fields];
        next.splice(idx, 1);
        next.forEach((f, i) => (f.order = (i + 1) * 10));
        setFields(next);
    };
    const handleSave = async () => {
        setLocalError(null);
        if (!name.trim()) {
            setLocalError('Name is required');
            return;
        }
        if (isNew) {
            try {
                const created = await createForm({
                    name: name.trim(),
                    slug: slug.trim() || slugify(name),
                    description: description.trim() || undefined,
                    navShow,
                    navPlacement: navPlacement === 'custom' ? 'under_forms' : navPlacement,
                    navGroup,
                    navWeight,
                    navLabel: navLabel.trim() || undefined,
                    navIcon: navIcon.trim() || undefined,
                    navParentPath: navPlacement === 'custom' ? navParentPath : undefined,
                });
                navigate(`/forms/${created.id}`);
                return;
            }
            catch (e) {
                setLocalError(e?.message || 'Failed to create form');
                return;
            }
        }
        if (!id)
            return;
        try {
            await saveForm(id, {
                name: name.trim(),
                description: description.trim() || undefined,
                navShow,
                navPlacement: navPlacement === 'custom' ? 'under_forms' : navPlacement,
                navGroup,
                navWeight,
                navLabel: navLabel.trim() || undefined,
                navIcon: navIcon.trim() || undefined,
                navParentPath: navPlacement === 'custom' ? navParentPath : null,
                draft: { fields },
            });
            await refresh();
        }
        catch (e) {
            setLocalError(e?.message || 'Failed to save form');
        }
    };
    if (!isNew && loadingForm) {
        return (_jsx(Page, { title: "Loading...", children: _jsx(Card, { children: _jsx("div", { className: "py-10", children: "Loading\u2026" }) }) }));
    }
    if (!isNew && loadError) {
        return (_jsx(Page, { title: "Form not found", actions: _jsxs(Button, { variant: "secondary", onClick: () => navigate('/forms'), children: [_jsx(ArrowLeft, { size: 16, className: "mr-2" }), "Back"] }), children: _jsx(Alert, { variant: "error", title: "Error", children: loadError.message }) }));
    }
    const breadcrumbs = [
        { label: 'Forms', href: '/forms', icon: _jsx(ClipboardList, { size: 14 }) },
        ...(!isNew && form ? [{ label: form.name, icon: _jsx(FileText, { size: 14 }) }] : []),
        { label: isNew ? 'New' : 'Edit' },
    ];
    return (_jsxs(Page, { title: isNew ? 'New Form' : 'Edit Form', description: isNew ? 'Create a new runtime form' : `Form definition`, breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { className: "flex items-center gap-2", children: [!isNew && (_jsx(Button, { variant: "secondary", onClick: () => navigate(`/forms/${id}/entries`), children: "View Entries" })), !isNew && (_jsxs(Button, { variant: "secondary", onClick: () => setShowAclModal(true), children: [_jsx(Share2, { size: 16, className: "mr-2" }), "Share"] })), _jsxs(Button, { variant: "primary", onClick: () => handleSave(), disabled: saving, children: [_jsx(Save, { size: 16, className: "mr-2" }), "Save"] })] }), children: [(saveError || localError) && (_jsx(Alert, { variant: "error", title: "Error saving", children: localError || saveError?.message })), _jsx(Card, { children: _jsxs("div", { className: "space-y-6", children: [_jsx(Input, { label: "Name", value: name, onChange: setName, placeholder: "e.g. Customer Intake", required: true }), _jsx(Input, { label: "Slug", value: slug, onChange: setSlug, placeholder: "e.g. customer-intake" }), _jsx(TextArea, { label: "Description", value: description, onChange: setDescription, rows: 3 })] }) }), _jsx(Card, { children: _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "text-lg font-semibold", children: "Sharing & Access" }), _jsx("p", { className: "text-sm text-gray-500", children: "Only you can access this form unless you add others below. Admins can always access all forms." }), isNew ? (_jsx("p", { className: "text-sm text-amber-600", children: "Save the form first to configure access permissions." })) : (_jsxs(Button, { variant: "secondary", onClick: () => setShowAclModal(true), children: [_jsx(Share2, { className: "w-4 h-4 mr-2" }), "Manage Access"] }))] }) }), _jsx(Card, { children: _jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "text-lg font-semibold", children: "Navigation" }), _jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: navShow, onChange: (e) => setNavShow(e.target.checked) }), "Show in navigation (for users with access)"] }), _jsx(Select, { label: "Placement", value: navPlacement, onChange: (v) => {
                                setNavPlacement(v);
                                if (v !== 'custom')
                                    setNavParentPath('');
                            }, options: [
                                { value: 'under_forms', label: 'Inside Custom Forms section' },
                                { value: 'top_level', label: 'Top-level (root sidebar)' },
                                { value: 'custom', label: 'Nested under existing nav item...' },
                            ] }), navPlacement === 'custom' && (_jsx(Select, { label: "Parent Nav Item", value: navParentPath, onChange: (v) => setNavParentPath(String(v)), options: [
                                { value: '', label: '— Select parent —' },
                                ...availableNavPaths.map((p) => ({
                                    value: p.path,
                                    label: '  '.repeat(p.depth) + p.label,
                                })),
                            ] })), _jsx(Select, { label: "Group", value: navGroup, onChange: (v) => setNavGroup(String(v)), options: [
                                { value: 'main', label: 'Main' },
                                { value: 'system', label: 'System' },
                            ] }), _jsx(Input, { label: "Weight", value: String(navWeight), onChange: (v) => setNavWeight(Number(v) || 500), placeholder: "Lower shows higher (default 500)" }), _jsx(Input, { label: "Nav label override", value: navLabel, onChange: setNavLabel, placeholder: "Leave empty to use form name" }), _jsx(Input, { label: "Icon (Lucide name)", value: navIcon, onChange: setNavIcon, placeholder: "e.g. FileText (optional)" })] }) }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-lg font-semibold", children: "Fields" }), _jsx("div", { className: "text-sm text-gray-500", children: "Order is applied to list/detail/edit screens" })] }), _jsxs(Button, { variant: "secondary", onClick: addField, children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add Field"] })] }), _jsxs("div", { className: "space-y-4", children: [fields.length === 0 && (_jsx("div", { className: "text-sm text-gray-500", children: "No fields yet. Add your first field." })), fields.map((f, idx) => (_jsxs("div", { className: "border border-gray-800 rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { label: "Key", value: f.key, onChange: (v) => {
                                                    const next = [...fields];
                                                    next[idx] = { ...next[idx], key: v };
                                                    setFields(next);
                                                } }), _jsx(Input, { label: "Label", value: f.label, onChange: (v) => {
                                                    const next = [...fields];
                                                    next[idx] = { ...next[idx], label: v };
                                                    setFields(next);
                                                } }), _jsx(Select, { label: "Type", value: f.type, onChange: (v) => {
                                                    const next = [...fields];
                                                    next[idx] = { ...next[idx], type: v };
                                                    setFields(next);
                                                }, options: [
                                                    { value: 'text', label: 'Text' },
                                                    { value: 'url', label: 'URL' },
                                                    { value: 'textarea', label: 'Textarea' },
                                                    { value: 'number', label: 'Number' },
                                                    { value: 'date', label: 'Date' },
                                                    { value: 'datetime', label: 'DateTime' },
                                                    { value: 'select', label: 'Select' },
                                                    { value: 'checkbox', label: 'Checkbox' },
                                                    { value: 'reference', label: 'Reference' },
                                                    { value: 'entity_reference', label: 'Entity Reference' },
                                                ] })] }), (() => {
                                        const renderDefaultValue = () => {
                                            const currentDefault = f.defaultValue;
                                            switch (f.type) {
                                                case 'text':
                                                case 'url':
                                                case 'textarea':
                                                    return (_jsx(Input, { label: "Default value (optional)", value: currentDefault != null ? String(currentDefault) : '', onChange: (v) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], defaultValue: v || null };
                                                            setFields(next);
                                                        }, placeholder: "Enter default value" }));
                                                case 'number':
                                                    return (_jsx(Input, { label: "Default value (optional)", value: currentDefault != null ? String(currentDefault) : '', onChange: (v) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], defaultValue: v ? Number(v) : null };
                                                            setFields(next);
                                                        }, placeholder: "Enter default number" }));
                                                case 'date':
                                                    return (_jsx(Input, { label: "Default value (optional)", value: currentDefault != null ? String(currentDefault) : '', onChange: (v) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], defaultValue: v || null };
                                                            setFields(next);
                                                        }, placeholder: "YYYY-MM-DD" }));
                                                case 'datetime':
                                                    return (_jsx(Input, { label: "Default value (optional)", value: currentDefault != null ? String(currentDefault) : '', onChange: (v) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], defaultValue: v || null };
                                                            setFields(next);
                                                        }, placeholder: "YYYY-MM-DDTHH:mm" }));
                                                case 'select': {
                                                    const optionsText = String(f.config?.optionsText || '');
                                                    const options = optionsText
                                                        .split('\n')
                                                        .map((line) => line.trim())
                                                        .filter(Boolean)
                                                        .map((line) => {
                                                        const [value] = line.split('|');
                                                        return { value: (value || '').trim(), label: line.trim() };
                                                    })
                                                        .filter((o) => o.value);
                                                    return (_jsx(Select, { label: "Default value (optional)", value: currentDefault != null ? String(currentDefault) : '', onChange: (v) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], defaultValue: v || null };
                                                            setFields(next);
                                                        }, options: [
                                                            { value: '', label: '— No default —' },
                                                            ...options,
                                                        ] }));
                                                }
                                                case 'checkbox':
                                                    return (_jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(currentDefault), onChange: (e) => {
                                                                    const next = [...fields];
                                                                    next[idx] = { ...next[idx], defaultValue: e.target.checked };
                                                                    setFields(next);
                                                                } }), "Default checked"] }));
                                                case 'reference':
                                                case 'entity_reference':
                                                    return (_jsx("div", { className: "text-sm text-gray-500", children: "Default values for references are not supported." }));
                                                default:
                                                    return null;
                                            }
                                        };
                                        return (_jsx("div", { className: "border-t border-gray-700 pt-3", children: renderDefaultValue() }));
                                    })(), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(f.required), onChange: (e) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], required: e.target.checked };
                                                            setFields(next);
                                                        } }), "Required"] }), _jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(f.hidden), onChange: (e) => {
                                                            const next = [...fields];
                                                            next[idx] = { ...next[idx], hidden: e.target.checked };
                                                            setFields(next);
                                                        } }), "Hidden"] }), _jsx("div", { className: "flex-1" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => moveField(idx, -1), children: "Up" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => moveField(idx, 1), children: "Down" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => removeField(idx), children: "Remove" })] }), f.type === 'select' && (_jsx(TextArea, { label: "Select options (one per line: value|label)", value: String(f.config?.optionsText || ''), onChange: (v) => {
                                            const next = [...fields];
                                            next[idx] = { ...next[idx], config: { ...(next[idx].config || {}), optionsText: v } };
                                            setFields(next);
                                        }, rows: 3 })), f.type === 'reference' && (_jsxs("div", { className: "space-y-3", children: [_jsx(Select, { label: "Target form", value: String(f.config?.reference?.targetFormId || ''), onChange: (v) => {
                                                    const next = [...fields];
                                                    const prevCfg = next[idx].config || {};
                                                    next[idx] = {
                                                        ...next[idx],
                                                        config: {
                                                            ...prevCfg,
                                                            reference: {
                                                                ...(prevCfg.reference || {}),
                                                                targetFormId: v,
                                                            },
                                                        },
                                                    };
                                                    setFields(next);
                                                }, options: [
                                                    { value: '', label: 'Select target form…' },
                                                    ...(allForms?.items || [])
                                                        .filter((x) => !id || x.id !== id)
                                                        .map((x) => ({
                                                        value: x.id,
                                                        label: `${x.name} (${x.slug})`,
                                                    })),
                                                ] }), _jsx(Input, { label: "Display field key", value: String(f.config?.reference?.displayFieldKey || ''), onChange: (v) => {
                                                    const next = [...fields];
                                                    const prevCfg = next[idx].config || {};
                                                    next[idx] = {
                                                        ...next[idx],
                                                        config: {
                                                            ...prevCfg,
                                                            reference: {
                                                                ...(prevCfg.reference || {}),
                                                                displayFieldKey: v,
                                                            },
                                                        },
                                                    };
                                                    setFields(next);
                                                }, placeholder: "e.g. name" }), _jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(f.config?.reference?.multi), onChange: (e) => {
                                                            const next = [...fields];
                                                            const prevCfg = next[idx].config || {};
                                                            next[idx] = {
                                                                ...next[idx],
                                                                config: {
                                                                    ...prevCfg,
                                                                    reference: {
                                                                        ...(prevCfg.reference || {}),
                                                                        multi: e.target.checked,
                                                                    },
                                                                },
                                                            };
                                                            setFields(next);
                                                        } }), "Allow multiple selections"] }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Stored as ", _jsx("code", { children: '{ formId, entryId, label }' }), " (or an array if multi)."] })] })), f.type === 'entity_reference' && (_jsxs("div", { className: "space-y-3", children: [_jsx(Select, { label: "Entity kind", value: String(f.config?.entity?.kind || 'project'), onChange: (v) => {
                                                    const next = [...fields];
                                                    const prevCfg = next[idx].config || {};
                                                    next[idx] = {
                                                        ...next[idx],
                                                        config: {
                                                            ...prevCfg,
                                                            entity: {
                                                                ...(prevCfg.entity || {}),
                                                                kind: v || 'project',
                                                            },
                                                        },
                                                    };
                                                    setFields(next);
                                                }, options: [
                                                    { value: 'project', label: 'Project' },
                                                ] }), _jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(f.config?.entity?.multi), onChange: (e) => {
                                                            const next = [...fields];
                                                            const prevCfg = next[idx].config || {};
                                                            next[idx] = {
                                                                ...next[idx],
                                                                config: {
                                                                    ...prevCfg,
                                                                    entity: {
                                                                        ...(prevCfg.entity || {}),
                                                                        multi: e.target.checked,
                                                                    },
                                                                },
                                                            };
                                                            setFields(next);
                                                        } }), "Allow multiple"] })] }))] }, f.id)))] })] }), !isNew && viewsAvailable && (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-lg font-semibold flex items-center gap-2", children: [_jsx(Eye, { size: 20 }), "Views"] }), _jsx("div", { className: "text-sm text-gray-500", children: "Configure saved views for the entries list. Views let users filter and organize data." })] }), _jsxs(Button, { variant: "secondary", onClick: () => {
                                    setEditingView(null);
                                    setViewBuilderName('');
                                    setViewBuilderDescription('');
                                    setViewBuilderFilters([]);
                                    setViewBuilderIsDefault(false);
                                    setShowViewBuilder(true);
                                }, children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add View"] })] }), _jsxs("div", { className: "space-y-2", children: [viewsLoading && (_jsx("div", { className: "text-sm text-gray-500", children: "Loading views..." })), !viewsLoading && views.length === 0 && (_jsx("div", { className: "text-sm text-gray-500 p-4 border border-dashed border-gray-600 rounded-lg text-center", children: "No views configured. Users can still create their own personal views from the entries list." })), views.map((view) => (_jsxs("div", { className: "flex items-center justify-between p-3 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-3", children: [view.isDefault && (_jsx(Star, { size: 16, className: "text-yellow-500" })), _jsxs("div", { children: [_jsxs("div", { className: "font-medium flex items-center gap-2", children: [view.name, view.isSystem && (_jsx("span", { className: "text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded", children: "System" }))] }), view.description && (_jsx("div", { className: "text-sm text-gray-500", children: view.description })), view.filters && view.filters.length > 0 && (_jsxs("div", { className: "text-xs text-gray-500 mt-1", children: [view.filters.length, " filter", view.filters.length !== 1 ? 's' : ''] }))] })] }), !view.isSystem && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                    setEditingView(view);
                                                    setViewBuilderName(view.name);
                                                    setViewBuilderDescription(view.description || '');
                                                    setViewBuilderFilters(view.filters || []);
                                                    setViewBuilderIsDefault(view.isDefault);
                                                    setShowViewBuilder(true);
                                                }, children: _jsx(Edit2, { size: 14 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: async () => {
                                                    if (!confirm(`Delete view "${view.name}"?`))
                                                        return;
                                                    try {
                                                        await deleteView(view.id);
                                                        refreshViews();
                                                    }
                                                    catch (err) {
                                                        alert(err?.message || 'Failed to delete view');
                                                    }
                                                }, children: _jsx(Trash2, { size: 14, className: "text-red-500" }) })] }))] }, view.id)))] })] })), showViewBuilder && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: editingView ? 'Edit View' : 'Create View' }), _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "View Name", value: viewBuilderName, onChange: setViewBuilderName, placeholder: "e.g., Active Items, Recent Entries" }), _jsx(TextArea, { label: "Description (optional)", value: viewBuilderDescription, onChange: setViewBuilderDescription, placeholder: "Describe what this view shows" }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "text-sm font-medium", children: "Filters" }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => {
                                                        const firstField = fields[0];
                                                        setViewBuilderFilters([
                                                            ...viewBuilderFilters,
                                                            {
                                                                field: firstField?.key || '',
                                                                operator: 'equals',
                                                                value: '',
                                                                valueType: 'string',
                                                                sortOrder: viewBuilderFilters.length,
                                                            },
                                                        ]);
                                                    }, children: [_jsx(Plus, { size: 14, className: "mr-1" }), "Add Filter"] })] }), viewBuilderFilters.length === 0 && (_jsx("div", { className: "text-sm text-gray-500 p-4 border border-dashed border-gray-600 rounded-lg text-center", children: "No filters. This view will show all entries." })), viewBuilderFilters.map((filter, idx) => {
                                            const fieldDef = fields.find((f) => f.key === filter.field);
                                            return (_jsxs("div", { className: "flex items-center gap-2 p-3 border border-gray-700 rounded-lg mb-2", children: [_jsx(Select, { value: filter.field, onChange: (v) => {
                                                            const next = [...viewBuilderFilters];
                                                            next[idx] = { ...next[idx], field: v };
                                                            setViewBuilderFilters(next);
                                                        }, options: fields.map((f) => ({ value: f.key, label: f.label })) }), _jsx(Select, { value: filter.operator, onChange: (v) => {
                                                            const next = [...viewBuilderFilters];
                                                            next[idx] = { ...next[idx], operator: v };
                                                            setViewBuilderFilters(next);
                                                        }, options: [
                                                            { value: 'equals', label: 'Equals' },
                                                            { value: 'notEquals', label: 'Not Equals' },
                                                            { value: 'contains', label: 'Contains' },
                                                            { value: 'isNull', label: 'Is Empty' },
                                                            { value: 'isNotNull', label: 'Is Not Empty' },
                                                        ] }), !['isNull', 'isNotNull'].includes(filter.operator) && (fieldDef?.type === 'select' && fieldDef?.config?.options ? (_jsx(Select, { value: String(filter.value || ''), onChange: (v) => {
                                                            const next = [...viewBuilderFilters];
                                                            next[idx] = { ...next[idx], value: v };
                                                            setViewBuilderFilters(next);
                                                        }, options: (fieldDef.config.options || []).map((opt) => ({
                                                            value: typeof opt === 'string' ? opt : opt.value,
                                                            label: typeof opt === 'string' ? opt : opt.label,
                                                        })) })) : (_jsx(Input, { value: String(filter.value || ''), onChange: (v) => {
                                                            const next = [...viewBuilderFilters];
                                                            next[idx] = { ...next[idx], value: v };
                                                            setViewBuilderFilters(next);
                                                        }, placeholder: "Value" }))), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                            setViewBuilderFilters(viewBuilderFilters.filter((_, i) => i !== idx));
                                                        }, children: _jsx(Trash2, { size: 14, className: "text-red-500" }) })] }, idx));
                                        })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: viewBuilderIsDefault, onChange: (e) => setViewBuilderIsDefault(e.target.checked) }), "Set as default view"] })] }), _jsxs("div", { className: "flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700", children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                        setShowViewBuilder(false);
                                        setEditingView(null);
                                    }, disabled: viewBuilderSaving, children: "Cancel" }), _jsx(Button, { variant: "primary", disabled: !viewBuilderName.trim() || viewBuilderSaving, onClick: async () => {
                                        if (!viewBuilderName.trim())
                                            return;
                                        setViewBuilderSaving(true);
                                        try {
                                            const viewData = {
                                                name: viewBuilderName.trim(),
                                                description: viewBuilderDescription.trim() || undefined,
                                                filters: viewBuilderFilters.filter((f) => f.field && f.operator),
                                                isDefault: viewBuilderIsDefault,
                                                isSystem: true, // FormBuilder creates system views visible to all users
                                            };
                                            if (editingView) {
                                                await updateView(editingView.id, viewData);
                                            }
                                            else {
                                                await createView(viewData);
                                            }
                                            refreshViews();
                                            setShowViewBuilder(false);
                                            setEditingView(null);
                                        }
                                        catch (err) {
                                            alert(err?.message || 'Failed to save view');
                                        }
                                        finally {
                                            setViewBuilderSaving(false);
                                        }
                                    }, children: viewBuilderSaving ? 'Saving...' : editingView ? 'Update View' : 'Create View' })] })] }) })), !isNew && id && (_jsx(FormAclModal, { formId: id, isOpen: showAclModal, onClose: () => setShowAclModal(false), onUpdate: () => refresh() }))] }));
}
export default FormBuilder;
//# sourceMappingURL=FormBuilder.js.map