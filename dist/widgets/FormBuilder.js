'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save, ClipboardList, FileText, Share2, Eye, Star, Trash2, Edit2, BarChart3 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { TableViewSharingPanel } from '@hit/ui-kit/components/TableViewSharingPanel';
import { useFormSubmit } from '@hit/ui-kit/hooks/useFormSubmit';
import { useTableView } from '@hit/ui-kit/hooks/useTableView';
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
    const { Page, Card, Button, Input, TextArea, Select, Alert, Modal } = useUi();
    const isNew = !id || id === 'new';
    const { form, version, loading: loadingForm, error: loadError, refresh } = useForm(isNew ? undefined : id);
    const { createForm, saveForm } = useFormMutations();
    const { submitting: saving, error: formError, submit, clearError, setError } = useFormSubmit();
    const { data: allForms } = useForms({ page: 1, pageSize: 200 });
    // UI specs entity registry (used to make entity_reference truly dynamic instead of hardcoding a few kinds).
    const [uiSpecEntityKindOptions, setUiSpecEntityKindOptions] = useState([]);
    useEffect(() => {
        let cancelled = false;
        async function loadUiSpecEntities() {
            try {
                const res = await fetch('/hit-ui-specs.json', { credentials: 'include' });
                if (!res.ok)
                    return;
                const json = await res.json().catch(() => null);
                const entities = json && typeof json === 'object' ? json.entities : null;
                if (!entities || typeof entities !== 'object')
                    return;
                const opts = [];
                for (const [entityKey, spec] of Object.entries(entities)) {
                    const meta = spec && typeof spec === 'object' ? spec.meta : null;
                    const titleSingular = meta && typeof meta === 'object' ? String(meta.titleSingular || '') : '';
                    const title = titleSingular.trim() || String(entityKey);
                    // Convention: forms entityKind uses `_` not `.` (e.g. `crm.contact` -> `crm_contact`)
                    const kind = String(entityKey).trim().replace(/\./g, '_');
                    if (!kind)
                        continue;
                    opts.push({ value: kind, label: `${title} (${String(entityKey)})` });
                }
                opts.sort((a, b) => a.label.localeCompare(b.label));
                if (!cancelled)
                    setUiSpecEntityKindOptions(opts);
            }
            catch {
                // best-effort; ignore
            }
        }
        void loadUiSpecEntities();
        return () => {
            cancelled = true;
        };
    }, []);
    // Table views for entries list
    const tableId = id && !isNew ? `form.${id}` : '';
    const { views, loading: viewsLoading, available: viewsAvailable, createView, updateView, deleteView, refresh: refreshViews, getShares, addShare, removeShare, } = useTableView({ tableId });
    const navigate = (path) => {
        if (!onNavigate)
            throw new Error('[forms] FormBuilder requires onNavigate for client-side navigation');
        onNavigate(path);
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
    const [showAclModal, setShowAclModal] = useState(false);
    // Views configuration - for managing list views
    const [showViewBuilder, setShowViewBuilder] = useState(false);
    const [editingView, setEditingView] = useState(null);
    const [viewBuilderName, setViewBuilderName] = useState('');
    const [viewBuilderDescription, setViewBuilderDescription] = useState('');
    const [viewBuilderFilters, setViewBuilderFilters] = useState([]);
    const [viewBuilderIsDefault, setViewBuilderIsDefault] = useState(false);
    const [viewBuilderSaving, setViewBuilderSaving] = useState(false);
    const [viewShares, setViewShares] = useState([]);
    const [viewSharesLoading, setViewSharesLoading] = useState(false);
    const [pendingShareRecipients, setPendingShareRecipients] = useState([]);
    // Metrics configuration
    const [metricsConfig, setMetricsConfig] = useState([]);
    const [metricsCatalog, setMetricsCatalog] = useState({});
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
        if (version?.listConfig?.metricsConfig) {
            setMetricsConfig(version.listConfig.metricsConfig.panels || []);
        }
        else {
            setMetricsConfig([]);
        }
    }, [form, version]);
    // Load metrics catalog
    useEffect(() => {
        async function loadMetricsCatalog() {
            try {
                const res = await fetch('/api/metrics/catalog');
                if (res.ok) {
                    const data = await res.json();
                    const items = Array.isArray(data?.items) ? data.items : [];
                    const byKey = {};
                    for (const it of items) {
                        if (it && typeof it.key === 'string')
                            byKey[it.key] = it;
                    }
                    setMetricsCatalog(byKey);
                }
            }
            catch {
                // Catalog not available, that's okay
            }
        }
        loadMetricsCatalog();
    }, []);
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
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (isNew) {
            const result = await submit(async () => {
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
                return { id: created.id };
            });
            if (result && typeof result === 'object' && result !== null) {
                const resultWithId = result;
                if (resultWithId.id) {
                    navigate(`/forms/${resultWithId.id}`);
                }
            }
            return;
        }
        if (!id)
            return;
        const result = await submit(async () => {
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
                draft: {
                    fields,
                    listConfig: metricsConfig.length > 0 ? { metricsConfig: { panels: metricsConfig } } : undefined,
                },
            });
            return { success: true };
        });
        if (result) {
            await refresh();
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
    return (_jsxs(Page, { title: isNew ? 'New Form' : 'Edit Form', description: isNew ? 'Create a new runtime form' : `Form definition`, breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { className: "flex items-center gap-2", children: [!isNew && (_jsx(Button, { variant: "secondary", onClick: () => navigate(`/forms/${id}/entries`), children: "View Entries" })), !isNew && (_jsxs(Button, { variant: "secondary", onClick: () => setShowAclModal(true), children: [_jsx(Share2, { size: 16, className: "mr-2" }), "Share"] })), _jsxs(Button, { variant: "primary", onClick: () => handleSave(), disabled: saving, children: [_jsx(Save, { size: 16, className: "mr-2" }), "Save"] })] }), children: [formError && (_jsx(Alert, { variant: "error", title: "Error saving", onClose: clearError, children: formError.message })), _jsx(Card, { children: _jsxs("div", { className: "space-y-6", children: [_jsx(Input, { label: "Name", value: name, onChange: setName, placeholder: "e.g. Customer Intake", required: true }), _jsx(Input, { label: "Slug", value: slug, onChange: setSlug, placeholder: "e.g. customer-intake" }), _jsx(TextArea, { label: "Description", value: description, onChange: setDescription, rows: 3 })] }) }), _jsx(Card, { children: _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "text-lg font-semibold", children: "Sharing & Access" }), _jsx("p", { className: "text-sm text-gray-500", children: "Only you can access this form unless you add others below. Admins can always access all forms." }), isNew ? (_jsx("p", { className: "text-sm text-amber-600", children: "Save the form first to configure access permissions." })) : (_jsxs(Button, { variant: "secondary", onClick: () => setShowAclModal(true), children: [_jsx(Share2, { className: "w-4 h-4 mr-2" }), "Manage Access"] }))] }) }), _jsx(Card, { children: _jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "text-lg font-semibold", children: "Navigation" }), _jsxs("label", { className: "text-sm flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: navShow, onChange: (e) => setNavShow(e.target.checked) }), "Show in navigation (for users with access)"] }), _jsx(Select, { label: "Placement", value: navPlacement, onChange: (v) => {
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
                                                        } }), "Allow multiple selections"] }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Stored as ", _jsx("code", { children: '{ formId, entryId, label }' }), " (or an array if multi)."] })] })), f.type === 'entity_reference' && (_jsxs("div", { className: "space-y-3", children: [_jsx(Input, { label: "Entity kind", value: String(f.config?.entity?.kind || 'project'), onChange: (v) => {
                                                    const next = [...fields];
                                                    const prevCfg = next[idx].config || {};
                                                    next[idx] = {
                                                        ...next[idx],
                                                        config: {
                                                            ...prevCfg,
                                                            entity: {
                                                                ...(prevCfg.entity || {}),
                                                                kind: String(v || '').trim() || 'project',
                                                            },
                                                        },
                                                    };
                                                    setFields(next);
                                                }, placeholder: "e.g. crm_contact (from crm.contact)" }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Tip: for schema-driven entities, use ", _jsx("code", { children: "entityKey" }), " with ", _jsx("code", { children: "." }), " replaced by ", _jsx("code", { children: "_" }), " (example: ", _jsx("code", { children: "crm.contact" }), " \u2192 ", _jsx("code", { children: "crm_contact" }), "). Projects use ", _jsx("code", { children: "project" }), "."] }), _jsx(Select, { label: "Quick pick (schema-driven entities)", value: "", onChange: (v) => {
                                                    const picked = String(v || '').trim();
                                                    if (!picked)
                                                        return;
                                                    const next = [...fields];
                                                    const prevCfg = next[idx].config || {};
                                                    next[idx] = {
                                                        ...next[idx],
                                                        config: {
                                                            ...prevCfg,
                                                            entity: {
                                                                ...(prevCfg.entity || {}),
                                                                kind: picked,
                                                            },
                                                        },
                                                    };
                                                    setFields(next);
                                                }, options: [
                                                    { value: '', label: 'Select…' },
                                                    { value: 'project', label: 'Project (legacy)' },
                                                    ...uiSpecEntityKindOptions,
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
                                                        } }), "Allow multiple"] })] }))] }, f.id)))] })] }), !isNew && viewsAvailable && (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-lg font-semibold flex items-center gap-2", children: [_jsx(Eye, { size: 20 }), "Views"] }), _jsx("div", { className: "text-sm text-gray-500", children: "Create curated views for the entries list and share them with users, groups, or roles." })] }), _jsxs(Button, { variant: "secondary", onClick: () => {
                                    setEditingView(null);
                                    setViewBuilderName('');
                                    setViewBuilderDescription('');
                                    setViewBuilderFilters([]);
                                    setViewBuilderIsDefault(false);
                                    setViewShares([]);
                                    setViewSharesLoading(false);
                                    setPendingShareRecipients([]);
                                    setShowViewBuilder(true);
                                }, children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add View"] })] }), _jsxs("div", { className: "space-y-2", children: [viewsLoading && (_jsx("div", { className: "text-sm text-gray-500", children: "Loading views..." })), !viewsLoading && views.filter((v) => v._category === 'user').length === 0 && (_jsx("div", { className: "text-sm text-gray-500 p-4 border border-dashed border-gray-600 rounded-lg text-center", children: "No curated views yet. Users can still create their own personal views from the entries list." })), views.filter((v) => v._category === 'user').map((view) => (_jsxs("div", { className: "flex items-center justify-between p-3 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-3", children: [view.isDefault && (_jsx(Star, { size: 16, className: "text-yellow-500" })), _jsxs("div", { children: [_jsxs("div", { className: "font-medium flex items-center gap-2", children: [view.name, view.isShared && (_jsx("span", { className: "text-xs px-2 py-0.5 bg-green-900 text-green-300 rounded", children: "Shared" }))] }), view.description && (_jsx("div", { className: "text-sm text-gray-500", children: view.description })), view.filters && view.filters.length > 0 && (_jsxs("div", { className: "text-xs text-gray-500 mt-1", children: [view.filters.length, " filter", view.filters.length !== 1 ? 's' : ''] }))] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: async () => {
                                                    setEditingView(view);
                                                    setViewBuilderName(view.name);
                                                    setViewBuilderDescription(view.description || '');
                                                    setViewBuilderFilters(view.filters || []);
                                                    setViewBuilderIsDefault(view.isDefault);
                                                    setPendingShareRecipients([]);
                                                    setViewShares([]);
                                                    setViewSharesLoading(true);
                                                    try {
                                                        const s = await getShares(view.id);
                                                        setViewShares(s);
                                                    }
                                                    catch {
                                                        setViewShares([]);
                                                    }
                                                    finally {
                                                        setViewSharesLoading(false);
                                                    }
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
                                                }, children: _jsx(Trash2, { size: 14, className: "text-red-500" }) })] })] }, view.id)))] })] })), !isNew && (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-lg font-semibold flex items-center gap-2", children: [_jsx(BarChart3, { size: 20 }), "Metrics"] }), _jsx("div", { className: "text-sm text-gray-500", children: "Configure metrics panels to display above the entries table. Metrics will be shown when this form is linked to entities." })] }), _jsxs(Button, { variant: "secondary", onClick: () => {
                                    setMetricsConfig([...metricsConfig, { title: '', metricKey: '', agg: 'sum', bucket: 'day', days: 90 }]);
                                }, children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add Metric Panel"] })] }), _jsxs("div", { className: "space-y-3", children: [metricsConfig.length === 0 && (_jsx("div", { className: "text-sm text-gray-500 p-4 border border-dashed border-gray-600 rounded-lg text-center", children: "No metrics configured. Add metric panels to display charts above the entries table." })), metricsConfig.map((panel, idx) => {
                                const metricDef = metricsCatalog[panel.metricKey];
                                return (_jsxs("div", { className: "border border-gray-700 rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm font-medium", children: ["Panel ", idx + 1] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                        setMetricsConfig(metricsConfig.filter((_, i) => i !== idx));
                                                    }, children: _jsx(Trash2, { size: 14, className: "text-red-500" }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Input, { label: "Title", value: panel.title, onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], title: v };
                                                        setMetricsConfig(next);
                                                    }, placeholder: "e.g., Revenue (USD)" }), _jsx(Select, { label: "Metric", value: panel.metricKey, onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], metricKey: v };
                                                        setMetricsConfig(next);
                                                    }, options: Object.entries(metricsCatalog).map(([key, def]) => ({
                                                        value: key,
                                                        label: `${def.label} (${key})`,
                                                    })), placeholder: "Select metric..." }), _jsx(Select, { label: "Aggregation", value: panel.agg, onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], agg: v };
                                                        setMetricsConfig(next);
                                                    }, options: [
                                                        { value: 'last', label: 'Last (Latest)' },
                                                        { value: 'sum', label: 'Sum' },
                                                        { value: 'avg', label: 'Average' },
                                                        { value: 'max', label: 'Max' },
                                                        { value: 'min', label: 'Min' },
                                                        { value: 'count', label: 'Count' },
                                                    ] }), _jsx(Select, { label: "Accumulation", value: panel.cumulative || '', onChange: (v) => {
                                                        const nextVal = v === 'range' || v === 'all_time' ? v : undefined;
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], cumulative: nextVal };
                                                        setMetricsConfig(next);
                                                    }, options: [
                                                        { value: '', label: 'None' },
                                                        { value: 'range', label: 'Cumulative (Range)' },
                                                        { value: 'all_time', label: 'Cumulative (All-time)' },
                                                    ] }), _jsx(Select, { label: "Time Bucket", value: panel.bucket, onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], bucket: v };
                                                        setMetricsConfig(next);
                                                    }, options: [
                                                        { value: 'hour', label: 'Hour' },
                                                        { value: 'day', label: 'Day' },
                                                        { value: 'week', label: 'Week' },
                                                        { value: 'month', label: 'Month' },
                                                    ] }), _jsx(Input, { label: "Days to Show", value: String(panel.days), onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], days: Number(v) || 90 };
                                                        setMetricsConfig(next);
                                                    }, placeholder: "90" }), _jsx(Input, { label: "Group Key (optional)", value: panel.groupKey || '', onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], groupKey: v || undefined };
                                                        setMetricsConfig(next);
                                                    }, placeholder: "e.g., discord" }), _jsx(Input, { label: "Group Label (optional)", value: panel.groupLabel || '', onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], groupLabel: v || undefined };
                                                        setMetricsConfig(next);
                                                    }, placeholder: "e.g., Discord" }), _jsx(Input, { label: "Group Icon (optional)", value: panel.groupIcon || '', onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], groupIcon: v || undefined };
                                                        setMetricsConfig(next);
                                                    }, placeholder: 'e.g., "Users", "Heart"' }), _jsx(Input, { label: "Group Color (optional)", value: panel.groupColor || '', onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], groupColor: v || undefined };
                                                        setMetricsConfig(next);
                                                    }, placeholder: 'e.g., "#5865F2"' }), _jsx(Select, { label: "Primary in Group?", value: String(Boolean(panel.groupPrimary)), onChange: (v) => {
                                                        const next = [...metricsConfig];
                                                        next[idx] = { ...next[idx], groupPrimary: v === 'true' };
                                                        setMetricsConfig(next);
                                                    }, options: [
                                                        { value: 'false', label: 'No' },
                                                        { value: 'true', label: 'Yes' },
                                                    ] })] }), metricDef && (_jsx("div", { className: "text-xs text-gray-500", children: metricDef.description || `${metricDef.label} (${metricDef.unit})` }))] }, idx));
                            })] })] })), _jsxs(Modal, { open: showViewBuilder, onClose: () => {
                    setShowViewBuilder(false);
                    setEditingView(null);
                    setViewShares([]);
                    setViewSharesLoading(false);
                    setPendingShareRecipients([]);
                }, title: editingView ? 'Edit View' : 'Create View', size: "lg", children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsx(Input, { label: "View Name", value: viewBuilderName, onChange: setViewBuilderName, placeholder: "e.g., Active Items, Recent Entries" }), _jsx(TextArea, { label: "Description (optional)", value: viewBuilderDescription, onChange: setViewBuilderDescription, placeholder: "Describe what this view shows" }), _jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }, children: [_jsx("span", { style: { fontSize: '14px', fontWeight: 500 }, children: "Filters" }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => {
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
                                                }, children: [_jsx(Plus, { size: 14, style: { marginRight: '4px' } }), "Add Filter"] })] }), viewBuilderFilters.length === 0 && (_jsx("div", { style: {
                                            fontSize: '14px',
                                            padding: '16px',
                                            border: '1px dashed var(--hit-border, #374151)',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            color: 'var(--hit-muted-foreground, #9ca3af)',
                                        }, children: "No filters. This view will show all entries." })), viewBuilderFilters.map((filter, idx) => {
                                        const fieldDef = fields.find((f) => f.key === filter.field);
                                        return (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '12px',
                                                border: '1px solid var(--hit-border, #374151)',
                                                borderRadius: '8px',
                                                marginBottom: '8px',
                                            }, children: [_jsx(Select, { value: filter.field, onChange: (v) => {
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
                                                    }, children: _jsx(Trash2, { size: 14, style: { color: 'var(--hit-error, #ef4444)' } }) })] }, idx));
                                    })] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }, children: [_jsx("input", { type: "checkbox", checked: viewBuilderIsDefault, onChange: (e) => setViewBuilderIsDefault(e.target.checked) }), "Set as default view"] }), _jsxs("div", { style: { borderTop: '1px solid var(--hit-border, #374151)', paddingTop: '16px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }, children: [_jsx(Share2, { size: 16 }), _jsx("span", { style: { fontSize: '14px', fontWeight: 500 }, children: "Sharing" })] }), _jsx(TableViewSharingPanel, { viewId: editingView?.id || null, shares: viewShares, setShares: setViewShares, sharesLoading: viewSharesLoading, pendingRecipients: pendingShareRecipients, setPendingRecipients: setPendingShareRecipients, addShare: addShare, removeShare: removeShare, allowPrincipalTypeSelection: true })] })] }), _jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            marginTop: '24px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--hit-border, #374151)',
                        }, children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                    setShowViewBuilder(false);
                                    setEditingView(null);
                                    setViewShares([]);
                                    setViewSharesLoading(false);
                                    setPendingShareRecipients([]);
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
                                        };
                                        if (editingView) {
                                            await updateView(editingView.id, viewData);
                                        }
                                        else {
                                            const newView = await createView(viewData);
                                            if (pendingShareRecipients.length > 0) {
                                                const failures = [];
                                                for (const r of pendingShareRecipients) {
                                                    try {
                                                        await addShare(newView.id, r.principalType, r.principalId);
                                                    }
                                                    catch (err) {
                                                        failures.push(`${r.principalId}${err?.message ? ` (${err.message})` : ''}`);
                                                    }
                                                }
                                                if (failures.length > 0) {
                                                    alert(`View created, but some shares failed:\n${failures.join('\n')}`);
                                                }
                                            }
                                        }
                                        refreshViews();
                                        setShowViewBuilder(false);
                                        setEditingView(null);
                                        setViewShares([]);
                                        setViewSharesLoading(false);
                                        setPendingShareRecipients([]);
                                    }
                                    catch (err) {
                                        alert(err?.message || 'Failed to save view');
                                    }
                                    finally {
                                        setViewBuilderSaving(false);
                                    }
                                }, children: viewBuilderSaving ? 'Saving...' : editingView ? 'Update View' : 'Create View' })] })] }), !isNew && id && (_jsx(FormAclModal, { formId: id, isOpen: showAclModal, onClose: () => setShowAclModal(false), onUpdate: () => refresh() }))] }));
}
export default FormBuilder;
//# sourceMappingURL=FormBuilder.js.map