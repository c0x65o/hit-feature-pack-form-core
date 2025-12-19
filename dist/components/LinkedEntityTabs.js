'use client';
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useLinkedFormEntries, useLinkedForms } from '../hooks/useLinkedEntities';
import { MetricsPanel } from './MetricsPanel';
function defaultRowHref(args) {
    return `/forms/${encodeURIComponent(args.formId)}/entries/${encodeURIComponent(args.entryId)}`;
}
function safeNavigate(path, onNavigate) {
    if (onNavigate)
        return onNavigate(path);
    window.location.href = path;
}
function applyViewFilters(rows, filters) {
    if (!filters || filters.length === 0)
        return rows;
    const norm = (v) => (v === null || v === undefined ? '' : String(v));
    return rows.filter((row) => {
        return filters.every((f) => {
            const raw = row?.[f.field];
            const v = raw === undefined ? row?.data?.[f.field] : raw;
            const s = norm(v);
            const fv = f.value;
            switch (f.operator) {
                case 'equals':
                    return s === norm(fv);
                case 'notEquals':
                    return s !== norm(fv);
                case 'contains':
                    return s.toLowerCase().includes(norm(fv).toLowerCase());
                case 'notContains':
                    return !s.toLowerCase().includes(norm(fv).toLowerCase());
                case 'startsWith':
                    return s.toLowerCase().startsWith(norm(fv).toLowerCase());
                case 'endsWith':
                    return s.toLowerCase().endsWith(norm(fv).toLowerCase());
                case 'isNull':
                    return v === null || v === undefined || s === '';
                case 'isNotNull':
                    return !(v === null || v === undefined || s === '');
                case 'isTrue':
                    return v === true || s === 'true' || s === '1';
                case 'isFalse':
                    return v === false || s === 'false' || s === '0';
                default:
                    // Unknown operator -> don't filter out
                    return true;
            }
        });
    });
}
export function LinkedEntityTabs({ entity, overview, overviewLabel = 'Overview', includeZeroCountTabs = true, pageSize = 25, onNavigate, rowHref = defaultRowHref, }) {
    const { Tabs, Card, DataTable } = useUi();
    const { items: linkedForms, loading: formsLoading } = useLinkedForms(entity);
    const [activeTab, setActiveTab] = useState('overview');
    const [page, setPage] = useState(1);
    const [viewFilters, setViewFilters] = useState([]);
    const [currentView, setCurrentView] = useState(null);
    const visibleLinkedForms = useMemo(() => {
        return includeZeroCountTabs ? linkedForms : linkedForms.filter((f) => f.count > 0);
    }, [linkedForms, includeZeroCountTabs]);
    const selectedFormInfo = useMemo(() => {
        if (activeTab === 'overview')
            return null;
        return visibleLinkedForms.find((f) => f.formId === activeTab) || null;
    }, [activeTab, visibleLinkedForms]);
    const tabs = useMemo(() => {
        const tabItems = [
            { id: 'overview', label: overviewLabel, content: null },
        ];
        for (const f of visibleLinkedForms) {
            tabItems.push({
                id: f.formId,
                label: f.count > 0 ? `${f.formName} (${f.count})` : f.formName,
                content: null,
            });
        }
        return tabItems;
    }, [overviewLabel, visibleLinkedForms]);
    const handleTabChange = useCallback((tabId) => {
        setActiveTab(tabId);
        setPage(1);
        setViewFilters([]);
        setCurrentView(null);
    }, [setActiveTab]);
    const { data: entriesData, loading: entriesLoading, refresh: refreshEntries } = useLinkedFormEntries(activeTab !== 'overview' && selectedFormInfo
        ? {
            formId: selectedFormInfo.formId,
            entity,
            entityFieldKey: selectedFormInfo.entityFieldKey,
            options: { page, pageSize },
        }
        : null);
    const visibleFields = useMemo(() => {
        return (entriesData?.fields || [])
            .filter((f) => !f.hidden && (f.showInTable !== false))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .slice(0, 10);
    }, [entriesData?.fields]);
    const columns = useMemo(() => {
        const dynamicCols = visibleFields.map((f) => {
            return {
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
                                return f.type === 'datetime' ? date.toLocaleString() : date.toLocaleDateString();
                            }
                        }
                        catch {
                            // fall through
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
        ];
    }, [visibleFields]);
    const rows = useMemo(() => {
        return (entriesData?.items || []).map((e) => ({
            id: e.id,
            data: e.data,
            updatedAt: e.updatedAt,
        }));
    }, [entriesData?.items]);
    const filteredRows = useMemo(() => applyViewFilters(rows, viewFilters), [rows, viewFilters]);
    const metricsMeta = useMemo(() => {
        const m = currentView?.metadata?.metrics;
        return m && typeof m === 'object' ? m : null;
    }, [currentView]);
    return (_jsxs("div", { children: [tabs.length > 0 && (_jsx("div", { style: { marginBottom: '24px' }, children: _jsx(Tabs, { tabs: tabs, value: activeTab, onValueChange: handleTabChange }) })), activeTab === 'overview' ? (_jsx(_Fragment, { children: overview })) : (_jsx(Card, { title: selectedFormInfo?.formName || 'Linked Entries', children: !selectedFormInfo ? (_jsx("div", { style: { textAlign: 'center', padding: '24px', color: 'var(--hit-muted-foreground, #64748b)' }, children: "Loading form information..." })) : entriesLoading ? (_jsx("div", { style: { textAlign: 'center', padding: '24px', color: 'var(--hit-muted-foreground, #64748b)' }, children: "Loading entries..." })) : (entriesData?.items || []).length === 0 ? (_jsxs("div", { style: { textAlign: 'center', padding: '24px', color: 'var(--hit-muted-foreground, #64748b)' }, children: ["No entries found for this ", entity.kind, "."] })) : (_jsxs(_Fragment, { children: [metricsMeta && (_jsx(MetricsPanel, { entityKind: entity.kind, entityId: entity.id, metrics: metricsMeta })), _jsx(DataTable, { columns: columns, data: filteredRows, emptyMessage: "No entries found", loading: entriesLoading || formsLoading, searchable: true, pageSize: pageSize, page: page, total: entriesData?.pagination.total, onPageChange: setPage, manualPagination: true, onRefresh: refreshEntries, refreshing: entriesLoading, tableId: `forms.entries.${selectedFormInfo.formId}`, enableViews: true, onViewChange: (view) => setCurrentView(view), onViewFiltersChange: (filters) => setViewFilters(filters), onRowClick: (row) => {
                                const href = rowHref({ formId: selectedFormInfo.formId, entryId: String(row.id) });
                                safeNavigate(href, onNavigate);
                            } })] })) }))] }));
}
//# sourceMappingURL=LinkedEntityTabs.js.map