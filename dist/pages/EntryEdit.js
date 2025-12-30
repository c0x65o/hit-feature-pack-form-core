'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, ClipboardList, FileText } from 'lucide-react';
import { useUi, useFormSubmit } from '@hit/ui-kit';
import { useEntry, useEntryMutations, useForm } from '../hooks/useForms';
export function EntryEdit({ id, entryId, onNavigate }) {
    const { Page, Card, Button, Input, TextArea, Select, Alert, Modal } = useUi();
    const formId = id;
    const isNew = !entryId || entryId === 'new';
    const { form, version, loading: loadingForm, error: formError } = useForm(formId);
    const { entry, loading: loadingEntry, error: loadError } = useEntry(formId, isNew ? undefined : entryId);
    const { createEntry, updateEntry } = useEntryMutations(formId);
    const { submitting, error, fieldErrors, submit, clearError, setFieldErrors, clearFieldError } = useFormSubmit();
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const fields = useMemo(() => {
        return (version?.fields || [])
            .filter((f) => !f.hidden)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [version]);
    const [data, setData] = useState({});
    const [defaultsInitialized, setDefaultsInitialized] = useState(false);
    // Initialize default values for new entries
    useEffect(() => {
        if (isNew && fields.length > 0 && !defaultsInitialized && !entry) {
            const defaults = {};
            fields.forEach((f) => {
                if (f.defaultValue !== null && f.defaultValue !== undefined) {
                    defaults[f.key] = f.defaultValue;
                }
            });
            if (Object.keys(defaults).length > 0) {
                setData(defaults);
            }
            setDefaultsInitialized(true);
        }
    }, [isNew, fields, entry, defaultsInitialized]);
    const [refPicker, setRefPicker] = useState({ open: false, fieldKey: null, targetFormId: null, displayFieldKey: null, multi: false });
    const [refSearch, setRefSearch] = useState('');
    const [refLoading, setRefLoading] = useState(false);
    const [refError, setRefError] = useState(null);
    const [refItems, setRefItems] = useState([]);
    const [entityPicker, setEntityPicker] = useState({ open: false, fieldKey: null, entityKind: null, multi: false });
    const [entitySearch, setEntitySearch] = useState('');
    const [entityLoading, setEntityLoading] = useState(false);
    const [entityError, setEntityError] = useState(null);
    const [entityItems, setEntityItems] = useState([]);
    useEffect(() => {
        if (entry?.data)
            setData(entry.data);
    }, [entry]);
    useEffect(() => {
        const run = async () => {
            if (!refPicker.open || !refPicker.targetFormId)
                return;
            try {
                setRefLoading(true);
                setRefError(null);
                const qs = new URLSearchParams({
                    page: '1',
                    pageSize: '25',
                    search: refSearch,
                });
                const res = await fetch(`/api/forms/${refPicker.targetFormId}/entries?${qs.toString()}`, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || err.message || res.statusText);
                }
                const json = await res.json();
                setRefItems((json.items || []).map((x) => ({ id: x.id, data: x.data })));
            }
            catch (e) {
                setRefError(e?.message || 'Failed to load references');
                setRefItems([]);
            }
            finally {
                setRefLoading(false);
            }
        };
        run();
    }, [refPicker.open, refPicker.targetFormId, refSearch]);
    useEffect(() => {
        const run = async () => {
            if (!entityPicker.open || !entityPicker.entityKind)
                return;
            try {
                setEntityLoading(true);
                setEntityError(null);
                setEntityItems([]);
                const qs = new URLSearchParams({
                    page: '1',
                    pageSize: '25',
                    search: entitySearch,
                });
                const kind = String(entityPicker.entityKind || '').trim();
                let url;
                let extractRows;
                let toItem;
                if (kind === 'project') {
                    url = `/api/projects?${qs.toString()}`;
                    extractRows = (json) => (Array.isArray(json?.data) ? json.data : []);
                    toItem = (p) => ({
                        id: String(p?.id || ''),
                        label: String(p?.slug || p?.name || p?.id || ''),
                    });
                }
                else if (kind === 'crm_contact') {
                    url = `/api/crm/contacts?${qs.toString()}`;
                    extractRows = (json) => (Array.isArray(json?.items) ? json.items : []);
                    toItem = (c) => ({
                        id: String(c?.id || ''),
                        label: String(c?.name || c?.email || c?.id || ''),
                    });
                }
                else if (kind === 'crm_company') {
                    url = `/api/crm/companies?${qs.toString()}`;
                    extractRows = (json) => (Array.isArray(json?.items) ? json.items : []);
                    toItem = (c) => ({
                        id: String(c?.id || ''),
                        label: String(c?.name || c?.id || ''),
                    });
                }
                else if (kind === 'crm_opportunity') {
                    url = `/api/crm/opportunities?${qs.toString()}`;
                    extractRows = (json) => (Array.isArray(json?.items) ? json.items : []);
                    toItem = (o) => ({
                        id: String(o?.id || ''),
                        label: String(o?.name || o?.title || o?.id || ''),
                    });
                }
                else {
                    throw new Error(`Unsupported entity kind: ${kind}`);
                }
                const res = await fetch(url, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || err.message || res.statusText);
                }
                const json = await res.json();
                const rows = extractRows(json);
                setEntityItems(rows
                    .map(toItem)
                    .filter((x) => x.id && x.label));
            }
            catch (e) {
                setEntityError(e?.message || 'Failed to load entities');
                setEntityItems([]);
            }
            finally {
                setEntityLoading(false);
            }
        };
        run();
    }, [entityPicker.open, entityPicker.entityKind, entitySearch]);
    const validate = () => {
        const errs = {};
        for (const f of fields) {
            if (f.required) {
                const v = data[f.key];
                if (v === undefined || v === null || v === '') {
                    errs[f.key] = `${f.label} is required`;
                }
            }
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };
    const parseSelectOptions = (f) => {
        const text = String(f.config?.optionsText || '').trim();
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
    };
    const renderField = (f) => {
        const v = data[f.key] ?? '';
        const err = fieldErrors[f.key];
        switch (f.type) {
            case 'text':
                return (_jsx(Input, { label: f.label, value: String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val })), required: Boolean(f.required), error: err }, f.key));
            case 'url':
                return (_jsx(Input, { label: f.label, value: String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val })), required: Boolean(f.required), error: err }, f.key));
            case 'textarea':
                return (_jsx(TextArea, { label: f.label, value: String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val })), rows: 6 }, f.key));
            case 'number':
                return (_jsx(Input, { label: f.label, value: v === '' ? '' : String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val === '' ? '' : Number(val) })), required: Boolean(f.required), error: err }, f.key));
            case 'date':
                return (_jsx(Input, { label: f.label, value: String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val })), type: "date" }, f.key));
            case 'datetime':
                return (_jsx(Input, { label: f.label, value: String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val })), type: "datetime-local" }, f.key));
            case 'checkbox':
                return (_jsxs("label", { className: "text-sm flex items-center gap-2 text-gray-900", children: [_jsx("input", { type: "checkbox", checked: Boolean(v), onChange: (e) => setData((p) => ({ ...p, [f.key]: e.target.checked })), className: "w-4 h-4" }), f.label] }, f.key));
            case 'select':
                return (_jsx(Select, { label: f.label, value: String(v), onChange: (val) => setData((p) => ({ ...p, [f.key]: val })), options: [{ value: '', label: 'Select…' }, ...parseSelectOptions(f)] }, f.key));
            case 'reference': {
                const refCfg = f.config?.reference || {};
                const targetFormId = String(refCfg.targetFormId || '');
                const displayFieldKey = String(refCfg.displayFieldKey || '');
                const multi = Boolean(refCfg.multi);
                const current = data[f.key];
                const currentList = Array.isArray(current)
                    ? current
                    : current && typeof current === 'object'
                        ? [current]
                        : [];
                const removeAt = (idx) => {
                    const next = [...currentList];
                    next.splice(idx, 1);
                    setData((p) => ({ ...p, [f.key]: multi ? next : (next[0] || null) }));
                };
                return (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-gray-700", children: f.label }), !targetFormId ? (_jsx(Alert, { variant: "warning", title: "Reference field not configured", children: "Set a target form + display field key in the form builder." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex flex-wrap gap-2", children: currentList.length === 0 ? (_jsx("div", { className: "text-sm text-gray-500", children: "No selection" })) : (currentList.map((r, idx) => (_jsxs("div", { className: "flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 bg-gray-100", children: [_jsx("a", { className: "text-sm text-gray-900 hover:text-blue-600 transition-colors", href: `/forms/${r.formId || targetFormId}/entries/${r.entryId}`, onClick: (e) => {
                                                    e.preventDefault();
                                                    navigate(`/forms/${r.formId || targetFormId}/entries/${r.entryId}`);
                                                }, children: r.label || r.entryId }), _jsx("button", { className: "text-xs text-gray-600 hover:text-red-600 transition-colors", onClick: () => removeAt(idx), children: "Remove" })] }, `${r.entryId}-${idx}`)))) }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => setRefPicker({
                                        open: true,
                                        fieldKey: f.key,
                                        targetFormId,
                                        displayFieldKey,
                                        multi,
                                    }), children: "Select\u2026" })] }))] }, f.key));
            }
            case 'entity_reference': {
                const eCfg = f.config?.entity || {};
                const entityKind = String(eCfg.kind || 'project');
                const multi = Boolean(eCfg.multi);
                const currentEnt = data[f.key];
                const currentEntList = Array.isArray(currentEnt)
                    ? currentEnt
                    : currentEnt && typeof currentEnt === 'object'
                        ? [currentEnt]
                        : [];
                const removeEntAt = (idx) => {
                    const next = [...currentEntList];
                    next.splice(idx, 1);
                    setData((p) => ({ ...p, [f.key]: multi ? next : (next[0] || null) }));
                };
                return (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-gray-700", children: f.label }), _jsx("div", { className: "flex flex-wrap gap-2", children: currentEntList.length === 0 ? (_jsx("div", { className: "text-sm text-gray-500", children: "No selection" })) : (currentEntList.map((r, idx) => (_jsxs("div", { className: "flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 bg-gray-100", children: [_jsx("span", { className: "text-sm text-gray-900", children: r.label || r.entityId }), _jsx("button", { className: "text-xs text-gray-600 hover:text-red-600 transition-colors", onClick: () => removeEntAt(idx), children: "Remove" })] }, `${r.entityId}-${idx}`)))) }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => setEntityPicker({
                                open: true,
                                fieldKey: f.key,
                                entityKind,
                                multi,
                            }), children: "Select\u2026" })] }, f.key));
            }
            default:
                return (_jsxs(Alert, { variant: "warning", title: f.label, children: ["Unsupported field type: ", String(f.type)] }, f.key));
        }
    };
    const handleSubmit = async () => {
        if (!validate())
            return;
        const result = await submit(async () => {
            if (isNew) {
                const created = await createEntry(data);
                return { id: created.id };
            }
            if (!entryId)
                throw new Error('Invalid state');
            await updateEntry(entryId, data);
            return { id: entryId };
        });
        if (result && typeof result === 'object' && result !== null) {
            const resultWithId = result;
            if (resultWithId.id) {
                navigate(`/forms/${formId}/entries/${resultWithId.id}`);
            }
        }
    };
    if (loadingForm || (!isNew && loadingEntry)) {
        return (_jsx(Page, { title: "Loading...", children: _jsx(Card, { children: _jsx("div", { className: "py-10", children: "Loading\u2026" }) }) }));
    }
    if (formError) {
        return (_jsx(Page, { title: "Form not found", actions: _jsxs(Button, { variant: "secondary", onClick: () => navigate('/forms'), children: [_jsx(ArrowLeft, { size: 16, className: "mr-2" }), "Back"] }), children: _jsx(Alert, { variant: "error", title: "Error", children: formError.message }) }));
    }
    if (!isNew && loadError) {
        return (_jsx(Page, { title: "Entry not found", actions: _jsxs(Button, { variant: "secondary", onClick: () => navigate(`/forms/${formId}/entries`), children: [_jsx(ArrowLeft, { size: 16, className: "mr-2" }), "Back"] }), children: _jsx(Alert, { variant: "error", title: "Error", children: loadError.message }) }));
    }
    const breadcrumbs = [
        { label: 'Forms', href: '/forms', icon: _jsx(ClipboardList, { size: 14 }) },
        ...(form ? [{ label: form.name, href: `/forms/${formId}`, icon: _jsx(FileText, { size: 14 }) }] : []),
        { label: 'Entries', href: `/forms/${formId}/entries` },
        ...(!isNew && entryId ? [{ label: `Entry ${entryId.slice(0, 8)}`, href: `/forms/${formId}/entries/${entryId}` }] : []),
        { label: isNew ? 'New' : 'Edit' },
    ];
    return (_jsxs(Page, { title: form?.name ? `${isNew ? 'New' : 'Edit'} ${form.name}` : isNew ? 'New Entry' : 'Edit Entry', breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsx("div", { className: "flex items-center gap-2", children: _jsxs(Button, { variant: "primary", onClick: handleSubmit, disabled: submitting, children: [_jsx(Save, { size: 16, className: "mr-2" }), submitting ? 'Saving...' : (isNew ? 'Create' : 'Save')] }) }), children: [error && (_jsx(Alert, { variant: "error", title: "Error saving", onClose: clearError, children: error.message })), _jsx(Modal, { open: refPicker.open, onClose: () => setRefPicker((p) => ({ ...p, open: false })), title: "Select reference", size: "lg", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Input, { label: "Search", value: refSearch, onChange: setRefSearch, placeholder: "Search\u2026" }), refError && (_jsx(Alert, { variant: "error", title: "Error", children: refError })), _jsx("div", { className: "max-h-[400px] overflow-y-auto flex flex-col gap-2", children: refLoading ? (_jsx("div", { className: "py-4 text-center text-gray-500", children: "Loading\u2026" })) : refItems.length === 0 ? (_jsx("div", { className: "py-4 text-center text-gray-500", children: "No results" })) : (refItems.map((item) => {
                                const label = refPicker.displayFieldKey && item.data
                                    ? item.data[refPicker.displayFieldKey]
                                    : null;
                                const display = label ? String(label) : item.id;
                                return (_jsxs("button", { onClick: () => {
                                        if (!refPicker.fieldKey || !refPicker.targetFormId)
                                            return;
                                        const refObj = {
                                            formId: refPicker.targetFormId,
                                            entryId: item.id,
                                            label: display,
                                        };
                                        setData((prev) => {
                                            const existing = prev[refPicker.fieldKey];
                                            if (refPicker.multi) {
                                                const arr = Array.isArray(existing) ? existing : [];
                                                const next = [...arr, refObj];
                                                return { ...prev, [refPicker.fieldKey]: next };
                                            }
                                            return { ...prev, [refPicker.fieldKey]: refObj };
                                        });
                                        setRefPicker((p) => ({ ...p, open: false }));
                                    }, className: "w-full text-left px-3 py-2 border border-gray-300 rounded hover:border-blue-600 hover:bg-blue-50 transition-colors", children: [_jsx("div", { className: "text-sm font-medium mb-1 text-gray-900", children: display }), _jsx("div", { className: "text-xs text-gray-500", children: item.id })] }, item.id));
                            })) })] }) }), _jsx(Modal, { open: entityPicker.open, onClose: () => setEntityPicker((p) => ({ ...p, open: false })), title: `Select ${entityPicker.entityKind}`, size: "lg", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Input, { label: "Search", value: entitySearch, onChange: setEntitySearch, placeholder: "Search\u2026" }), entityError && (_jsx(Alert, { variant: "error", title: "Error", children: entityError })), _jsx("div", { className: "max-h-[400px] overflow-y-auto flex flex-col gap-2", children: entityLoading ? (_jsx("div", { className: "py-4 text-center text-gray-500", children: "Loading\u2026" })) : entityItems.length === 0 ? (_jsx("div", { className: "py-4 text-center text-gray-500", children: "No results" })) : (entityItems.map((item) => {
                                const currentValue = data[entityPicker.fieldKey];
                                const isSelected = entityPicker.multi
                                    ? Array.isArray(currentValue) && currentValue.some((v) => v?.entityId === item.id)
                                    : currentValue?.entityId === item.id;
                                return (_jsxs("button", { onClick: () => {
                                        if (!entityPicker.fieldKey || !entityPicker.entityKind)
                                            return;
                                        const obj = { entityKind: entityPicker.entityKind, entityId: item.id, label: item.label };
                                        setData((prev) => {
                                            const existing = prev[entityPicker.fieldKey];
                                            if (entityPicker.multi) {
                                                const arr = Array.isArray(existing) ? existing : [];
                                                // Toggle selection for multi
                                                const isAlreadySelected = arr.some((v) => v?.entityId === item.id);
                                                if (isAlreadySelected) {
                                                    return { ...prev, [entityPicker.fieldKey]: arr.filter((v) => v?.entityId !== item.id) };
                                                }
                                                return { ...prev, [entityPicker.fieldKey]: [...arr, obj] };
                                            }
                                            // For single selection, return the selected object
                                            return { ...prev, [entityPicker.fieldKey]: obj };
                                        });
                                        // Close modal for single selection
                                        if (!entityPicker.multi) {
                                            setEntityPicker((p) => ({ ...p, open: false }));
                                        }
                                    }, className: `w-full text-left px-3 py-2 border rounded transition-colors ${isSelected
                                        ? 'border-blue-600 bg-blue-100 text-blue-900'
                                        : 'border-gray-300 hover:border-blue-600 hover:bg-blue-50 text-gray-900'}`, children: [_jsx("div", { className: "text-sm font-medium mb-1", children: item.label }), _jsx("div", { className: `text-xs ${isSelected ? 'text-blue-700' : 'text-gray-500'}`, children: item.id })] }, item.id));
                            })) })] }) }), _jsx(Card, { children: _jsx("div", { className: "space-y-6", children: !version ? (_jsx(Alert, { variant: "warning", title: "Form not configured", children: "This form has no draft version. Please create a draft version in the form builder." })) : fields.length === 0 ? (_jsx(Alert, { variant: "warning", title: "No fields", children: "This form has no fields yet. Add fields in the form builder." })) : (fields.map(renderField)) }) })] }));
}
export default EntryEdit;
//# sourceMappingURL=EntryEdit.js.map