'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, } from 'recharts';
function getAuthHeaders() {
    if (typeof window === 'undefined')
        return {};
    const token = localStorage.getItem('hit_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function toDateInput(d) {
    return d.toISOString();
}
function toPascal(s) {
    return String(s || '')
        .trim()
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? String(c).toUpperCase() : ''))
        .replace(/^(.)/, (m) => m.toUpperCase());
}
function resolveLucideIcon(name) {
    const n = String(name || '').trim();
    if (!n)
        return null;
    const key = toPascal(n);
    const Comp = LucideIcons[key];
    return Comp || null;
}
const MAX_GROUP_HEADER_CHIPS = 2;
function formatValue(value, unit) {
    if (!Number.isFinite(value))
        return '';
    const u = String(unit || '').toLowerCase();
    if (u === 'usd' || u === '$') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }
    // default numeric
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
function formatAxisTick(value, unit) {
    if (!Number.isFinite(value))
        return '';
    const u = String(unit || '').toLowerCase();
    if (u === 'usd' || u === '$') {
        // compact on axis for readability
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value);
    }
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
function isoDateOnly(d) {
    // YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function computeRange(preset, customStart, customEnd) {
    const end = new Date();
    const start = new Date(end);
    if (preset === '30d')
        start.setDate(start.getDate() - 30);
    else if (preset === '60d')
        start.setDate(start.getDate() - 60);
    else if (preset === '90d')
        start.setDate(start.getDate() - 90);
    else if (preset === '6m')
        start.setDate(start.getDate() - 180);
    else if (preset === '1y')
        start.setDate(start.getDate() - 365);
    else if (preset === 'all')
        return { start: new Date('2000-01-01T00:00:00.000Z'), end };
    else {
        // custom
        if (!customStart || !customEnd)
            return null;
        const s = new Date(`${customStart}T00:00:00.000Z`);
        const e = new Date(`${customEnd}T23:59:59.999Z`);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s)
            return null;
        return { start: s, end: e };
    }
    return { start, end };
}
function GroupCurrentValue(props) {
    const [value, setValue] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        let cancelled = false;
        async function run() {
            const end = props.end;
            const ids = props.entityIds;
            if (!end || !props.metricKey || ids.length === 0) {
                if (!cancelled)
                    setValue(null);
                return;
            }
            try {
                if (!cancelled)
                    setLoading(true);
                const res = await fetch('/api/metrics/query', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({
                        metricKey: props.metricKey,
                        bucket: 'none',
                        agg: props.agg || 'last',
                        end: toDateInput(end),
                        entityKind: props.entityKind,
                        entityIds: ids,
                    }),
                });
                if (!res.ok) {
                    if (!cancelled)
                        setValue(null);
                    return;
                }
                const json = await res.json().catch(() => null);
                const v = Array.isArray(json?.data) && json.data[0]?.value != null ? Number(json.data[0].value) : null;
                if (!cancelled)
                    setValue(Number.isFinite(v) ? v : null);
            }
            catch {
                if (!cancelled)
                    setValue(null);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [props.entityKind, JSON.stringify(props.entityIds), props.metricKey, props.end?.toISOString(), props.agg]);
    if (loading)
        return _jsx("span", { className: props.className || 'text-sm text-muted-foreground', children: "\u2026" });
    if (value === null)
        return _jsx("span", { className: props.className || 'text-sm text-muted-foreground', children: props.placeholder || '—' });
    return _jsx("span", { className: props.className || 'text-sm font-medium', children: formatValue(value, props.unit) });
}
export function MetricsPanel(props) {
    const { Card, Select, Button, Alert } = useUi();
    const panels = Array.isArray(props.metrics?.panels) ? props.metrics.panels : [];
    if (panels.length === 0)
        return null;
    const grouped = useMemo(() => {
        const groups = new Map();
        const ungrouped = [];
        for (const p of panels) {
            const gk = typeof p.groupKey === 'string' ? String(p.groupKey).trim() : '';
            if (!gk) {
                ungrouped.push(p);
                continue;
            }
            const label = typeof p.groupLabel === 'string' && String(p.groupLabel).trim()
                ? String(p.groupLabel).trim()
                : gk;
            const icon = typeof p.groupIcon === 'string' ? String(p.groupIcon).trim() : '';
            const existing = groups.get(gk) || { key: gk, label, icon: icon || undefined, panels: [] };
            // Prefer the first non-empty label/icon we see for the group
            if (!existing.label && label)
                existing.label = label;
            if (!existing.icon && icon)
                existing.icon = icon;
            existing.panels.push(p);
            groups.set(gk, existing);
        }
        const orderedGroups = Array.from(groups.values());
        // Preserve panel order as much as possible by sorting groups by first panel index.
        orderedGroups.sort((a, b) => {
            const ai = panels.findIndex((p) => a.panels.includes(p));
            const bi = panels.findIndex((p) => b.panels.includes(p));
            return ai - bi;
        });
        return { ungrouped, groups: orderedGroups };
    }, [panels]);
    const [expandedGroups, setExpandedGroups] = useState(() => new Set());
    const toggleGroup = (key) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    };
    // Global time range selector (default 90d)
    const [preset, setPreset] = useState('90d');
    const [customStart, setCustomStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return isoDateOnly(d);
    });
    const [customEnd, setCustomEnd] = useState(() => isoDateOnly(new Date()));
    const [customError, setCustomError] = useState(null);
    const range = useMemo(() => computeRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
    const handleApplyCustom = () => {
        const r = computeRange('custom', customStart, customEnd);
        if (!r) {
            setCustomError('Invalid custom range (end must be after start).');
            return;
        }
        setCustomError(null);
        setPreset('custom');
    };
    const [catalogByKey, setCatalogByKey] = useState({});
    useEffect(() => {
        let cancelled = false;
        async function loadCatalog() {
            try {
                const res = await fetch('/api/metrics/catalog', { credentials: 'include', headers: { ...getAuthHeaders() } });
                if (!res.ok)
                    return;
                const json = await res.json().catch(() => null);
                const items = Array.isArray(json?.items) ? json.items : [];
                const map = {};
                for (const it of items) {
                    if (it && typeof it.key === 'string')
                        map[it.key] = it;
                }
                if (!cancelled)
                    setCatalogByKey(map);
            }
            catch {
                // ignore
            }
        }
        loadCatalog();
        return () => {
            cancelled = true;
        };
    }, []);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsx("div", { className: "text-lg font-semibold", children: "Metrics" }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-end", children: [_jsx(Select, { label: "Range", value: preset, onChange: (v) => {
                                            setCustomError(null);
                                            setPreset(v);
                                        }, options: [
                                            { value: '30d', label: '30d' },
                                            { value: '60d', label: '60d' },
                                            { value: '90d', label: '90d' },
                                            { value: '6m', label: '6m' },
                                            { value: '1y', label: '1y' },
                                            { value: 'all', label: 'All' },
                                            { value: 'custom', label: 'Custom' },
                                        ] }), preset === 'custom' && (_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-end", children: [_jsxs("label", { className: "text-sm", children: [_jsx("div", { className: "mb-1 text-muted-foreground", children: "Start" }), _jsx("input", { className: "h-10 px-3 rounded-md border border-gray-300 bg-white text-sm", type: "date", value: customStart, onChange: (e) => setCustomStart(e.target.value) })] }), _jsxs("label", { className: "text-sm", children: [_jsx("div", { className: "mb-1 text-muted-foreground", children: "End" }), _jsx("input", { className: "h-10 px-3 rounded-md border border-gray-300 bg-white text-sm", type: "date", value: customEnd, onChange: (e) => setCustomEnd(e.target.value) })] }), _jsx(Button, { variant: "secondary", onClick: handleApplyCustom, children: "Apply" })] }))] })] }), customError && (_jsx("div", { className: "mt-3", children: _jsx(Alert, { variant: "error", title: "Range error", children: customError }) }))] }), grouped.ungrouped.map((p, idx) => (_jsx(MetricsPanelItem, { entityKind: props.entityKind, entityId: props.entityId, entityIds: props.entityIds, panel: p, range: range, unit: catalogByKey[p.metricKey]?.unit }, `${p.metricKey}-${idx}`))), grouped.groups.map((g) => {
                const isOpen = expandedGroups.has(g.key);
                const Icon = resolveLucideIcon(g.icon);
                const primary = g.panels.find((p) => Boolean(p.groupPrimary)) ||
                    g.panels.find((p) => (p.agg || 'sum') === 'last') ||
                    g.panels[0];
                const chevron = isOpen ? _jsx(ChevronDown, { size: 18 }) : _jsx(ChevronRight, { size: 18 });
                const primaryLabel = String(primary?.title || primary?.metricKey || 'Current');
                const groupEntityIds = (Array.isArray(props.entityIds) && props.entityIds.length > 0
                    ? props.entityIds
                    : props.entityId
                        ? [props.entityId]
                        : []);
                const chipPanels = g.panels
                    .filter((p) => p !== primary)
                    .slice(0, Math.max(0, MAX_GROUP_HEADER_CHIPS - 1));
                return (_jsxs(Card, { children: [_jsxs("button", { type: "button", className: "w-full flex items-center justify-between gap-4 text-left", onClick: () => toggleGroup(g.key), children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("span", { className: "text-muted-foreground", children: chevron }), _jsx("div", { className: "h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0", children: Icon ? _jsx(Icon, { size: 18, className: "text-muted-foreground" }) : _jsx("span", { className: "text-xs text-muted-foreground", children: "\u2014" }) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("div", { className: "font-semibold truncate", children: g.label }), _jsx("span", { className: "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground shrink-0", children: g.panels.length })] }), _jsxs("div", { className: "text-xs text-muted-foreground truncate", children: [primaryLabel, g.panels.length > 1 ? ` · ${g.panels.length} metrics` : ''] })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "hidden lg:flex items-center gap-2", children: chipPanels.map((p, idx) => (_jsxs("div", { className: "px-2 py-1 rounded-full bg-muted/50 text-xs flex items-center gap-2", children: [_jsx("span", { className: "text-muted-foreground truncate max-w-[140px]", children: String(p.title || p.metricKey) }), _jsx(GroupCurrentValue, { entityKind: props.entityKind, entityIds: groupEntityIds, metricKey: p.metricKey, end: range?.end, unit: catalogByKey[p.metricKey]?.unit, agg: (p.agg || 'last'), className: "text-xs font-semibold tabular-nums", placeholder: "\u2014" })] }, `${g.key}.chip.${p.metricKey}.${idx}`))) }), _jsxs("div", { className: "text-right", children: [_jsx(GroupCurrentValue, { entityKind: props.entityKind, entityIds: groupEntityIds, metricKey: primary.metricKey, end: range?.end, unit: catalogByKey[primary.metricKey]?.unit, agg: (primary.agg || 'last'), className: "text-xl font-semibold leading-none", placeholder: "\u2014" }), _jsx("div", { className: "text-xs text-muted-foreground mt-1", children: "Current" })] })] })] }), isOpen ? (_jsx("div", { className: "mt-4 space-y-4", children: g.panels.map((p, idx) => (_jsx(MetricsPanelItem, { entityKind: props.entityKind, entityId: props.entityId, entityIds: props.entityIds, panel: p, range: range, unit: catalogByKey[p.metricKey]?.unit }, `${g.key}.${p.metricKey}.${idx}`))) })) : null] }, `group.${g.key}`));
            })] }));
}
function MetricsPanelItem(props) {
    const { Card, Alert } = useUi();
    const title = props.panel.title || props.panel.metricKey;
    const bucket = props.panel.bucket || 'day';
    const agg = props.panel.agg || 'sum';
    const cumulative = props.panel.cumulative;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [baseline, setBaseline] = useState(0);
    const [debug, setDebug] = useState(null);
    const start = props.range?.start;
    const end = props.range?.end;
    const entityIds = useMemo(() => {
        const ids = Array.isArray(props.entityIds) ? props.entityIds.filter((x) => typeof x === 'string' && x.trim()) : [];
        if (ids.length > 0)
            return ids;
        return props.entityId ? [props.entityId] : [];
    }, [props.entityIds, props.entityId]);
    const overlayEnabled = props.entityKind === 'project' && entityIds.length === 1 && props.panel.timelineOverlay !== false;
    const [timelineEvents, setTimelineEvents] = useState([]);
    // For cumulative all-time, compute baseline total before start.
    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!start || !cumulative || cumulative !== 'all_time') {
                setBaseline(0);
                return;
            }
            if (entityIds.length === 0) {
                setBaseline(0);
                return;
            }
            try {
                const baselineEnd = new Date(start.getTime() - 1);
                const res = await fetch('/api/metrics/query', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders(),
                    },
                    body: JSON.stringify({
                        metricKey: props.panel.metricKey,
                        bucket: 'none',
                        agg: 'sum',
                        start: '2000-01-01T00:00:00.000Z',
                        end: toDateInput(baselineEnd),
                        entityKind: props.entityKind,
                        entityIds,
                        dimensions: props.panel.dimensions || undefined,
                    }),
                });
                if (!res.ok) {
                    if (!cancelled)
                        setBaseline(0);
                    return;
                }
                const json = await res.json().catch(() => null);
                const v = Array.isArray(json?.data) && json.data[0]?.value != null ? Number(json.data[0].value) : 0;
                if (!cancelled)
                    setBaseline(Number.isFinite(v) ? v : 0);
            }
            catch {
                if (!cancelled)
                    setBaseline(0);
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [props.entityKind, JSON.stringify(entityIds), props.panel.metricKey, cumulative, start?.toISOString(), JSON.stringify(props.panel.dimensions || {})]);
    useEffect(() => {
        let cancelled = false;
        async function run() {
            setLoading(true);
            setError(null);
            try {
                if (!start || !end) {
                    setRows([]);
                    return;
                }
                if (entityIds.length === 0) {
                    setRows([]);
                    setDebug({
                        entityKind: props.entityKind,
                        entityIds,
                        metricKey: props.panel.metricKey,
                        bucket,
                        agg,
                        start: start ? start.toISOString() : undefined,
                        end: end ? end.toISOString() : undefined,
                        rows: 0,
                    });
                    return;
                }
                const res = await fetch('/api/metrics/query', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders(),
                    },
                    body: JSON.stringify({
                        metricKey: props.panel.metricKey,
                        bucket,
                        agg,
                        start: toDateInput(start),
                        end: toDateInput(end),
                        entityKind: props.entityKind,
                        entityIds,
                        dimensions: props.panel.dimensions || undefined,
                    }),
                });
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    throw new Error(json?.error || `Query failed (${res.status})`);
                }
                const json = await res.json().catch(() => null);
                const data = (Array.isArray(json?.data) ? json.data : [])
                    .map((r) => ({
                    bucket: r?.bucket ? String(r.bucket) : '',
                    value: r?.value === null || r?.value === undefined ? null : Number(r.value),
                }))
                    .filter((r) => r.bucket && Number.isFinite(r.value))
                    .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
                if (!cancelled) {
                    setRows(data);
                    setDebug({
                        entityKind: props.entityKind,
                        entityIds,
                        metricKey: props.panel.metricKey,
                        bucket,
                        agg,
                        start: start ? start.toISOString() : undefined,
                        end: end ? end.toISOString() : undefined,
                        rows: data.length,
                    });
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(e?.message || 'Failed to load metrics');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [props.entityKind, JSON.stringify(entityIds), props.panel.metricKey, bucket, agg, start?.toISOString(), end?.toISOString(), JSON.stringify(props.panel.dimensions || {})]);
    // Load project timeline events for overlay (best-effort).
    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!overlayEnabled || !start || !end) {
                setTimelineEvents([]);
                return;
            }
            const projectId = entityIds[0];
            try {
                const qs = new URLSearchParams({
                    from: toDateInput(start),
                    to: toDateInput(end),
                    pageSize: '500',
                });
                const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/activity?${qs.toString()}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { ...getAuthHeaders() },
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `Failed (${res.status})`);
                const items = Array.isArray(json?.data) ? json.data : [];
                const mapped = items
                    .map((a) => ({
                    id: String(a.id || ''),
                    title: String(a.title || a.description || a.activityType || 'Activity'),
                    typeColor: a?.activityTypeRecord?.color || null,
                    occurredAt: String(a.occurredAt || a.createdAt || ''),
                    endAt: a?.endAt ? String(a.endAt) : null,
                }))
                    .filter((x) => x.id && x.occurredAt);
                if (!cancelled)
                    setTimelineEvents(mapped);
            }
            catch {
                if (!cancelled)
                    setTimelineEvents([]);
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [overlayEnabled, JSON.stringify(entityIds), start?.toISOString(), end?.toISOString()]);
    const chartData = useMemo(() => {
        // Expect rows like { bucket: '2025-01-01T00:00:00.000Z', value: '123.45' }
        const base = rows
            .map((r) => ({
            bucket: r.bucket ? String(r.bucket) : '',
            value: r.value === null || r.value === undefined ? null : Number(r.value),
        }))
            .filter((r) => r.bucket && Number.isFinite(r.value));
        if (!cumulative)
            return base;
        let running = cumulative === 'all_time' ? baseline : 0;
        return base.map((r) => {
            running += Number(r.value);
            return { ...r, value: running };
        });
    }, [rows, cumulative, baseline]);
    const chartDataWithTs = useMemo(() => {
        if (!overlayEnabled)
            return chartData;
        return chartData
            .map((d) => {
            const ts = d.bucket ? new Date(String(d.bucket)).getTime() : NaN;
            return { ...d, _ts: Number.isFinite(ts) ? ts : null };
        })
            .filter((d) => d._ts != null);
    }, [chartData, overlayEnabled]);
    const { referenceLines, referenceAreas } = useMemo(() => {
        if (!overlayEnabled || chartDataWithTs.length === 0 || timelineEvents.length === 0) {
            return { referenceLines: [], referenceAreas: [] };
        }
        const ts = chartDataWithTs.map((d) => Number(d._ts)).filter((n) => Number.isFinite(n));
        if (ts.length === 0)
            return { referenceLines: [], referenceAreas: [] };
        const minTs = Math.min(...ts);
        const maxTs = Math.max(...ts);
        const lines = [];
        const areas = [];
        for (const ev of timelineEvents) {
            const startTs = new Date(ev.occurredAt).getTime();
            if (!Number.isFinite(startTs))
                continue;
            const endTs = ev.endAt ? new Date(ev.endAt).getTime() : null;
            const color = ev.typeColor || '#6b7280';
            const intersects = endTs ? !(endTs < minTs || startTs > maxTs) : startTs >= minTs && startTs <= maxTs;
            if (!intersects)
                continue;
            if (endTs && endTs > startTs) {
                areas.push(_jsx(ReferenceArea, { x1: Math.max(minTs, startTs), x2: Math.min(maxTs, endTs), fill: color, fillOpacity: 0.10, stroke: color, strokeWidth: 1.5, strokeDasharray: "4 2" }, `area_${ev.id}`));
            }
            else {
                lines.push(_jsx(ReferenceLine, { x: startTs, stroke: color, strokeWidth: 2, strokeDasharray: "4 2", strokeOpacity: 0.7 }, `line_${ev.id}`));
            }
        }
        return { referenceLines: lines, referenceAreas: areas };
    }, [overlayEnabled, chartDataWithTs, timelineEvents]);
    const rangeTotal = useMemo(() => {
        if (!rows || rows.length === 0)
            return null;
        const s = rows.reduce((acc, r) => acc + (r?.value == null ? 0 : Number(r.value)), 0);
        return Number.isFinite(s) ? s : null;
    }, [rows]);
    const latestValue = useMemo(() => {
        if (chartData.length === 0)
            return null;
        return chartData[chartData.length - 1].value;
    }, [chartData]);
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-baseline justify-between gap-4 mb-3", children: [_jsx("div", { className: "text-lg font-semibold", children: title }), _jsx("div", { className: "text-sm text-muted-foreground", children: latestValue === null ? '' : formatValue(latestValue, props.unit) })] }), cumulative && rangeTotal !== null && (_jsx("div", { className: "text-xs text-muted-foreground mb-2", children: cumulative === 'range'
                    ? `Range total: ${formatValue(rangeTotal, props.unit)}`
                    : `Range total: ${formatValue(rangeTotal, props.unit)} · All-time: ${formatValue((baseline || 0) + rangeTotal, props.unit)}` })), error ? (_jsx(Alert, { variant: "error", title: "Metrics error", children: error })) : loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : chartData.length === 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-sm text-muted-foreground", children: "No data" }), debug && (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "text-xs text-muted-foreground cursor-pointer select-none", children: "Debug" }), _jsx("div", { className: "mt-2 text-xs text-muted-foreground whitespace-pre-wrap", children: JSON.stringify(debug, null, 2) })] }))] })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(LineChart, { data: overlayEnabled ? chartDataWithTs : chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: overlayEnabled ? '_ts' : 'bucket', type: overlayEnabled ? 'number' : undefined, scale: overlayEnabled ? 'time' : undefined, domain: overlayEnabled ? ['dataMin', 'dataMax'] : undefined, tickFormatter: (v) => {
                                try {
                                    const d = new Date(overlayEnabled ? Number(v) : String(v));
                                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                }
                                catch {
                                    return String(v);
                                }
                            } }), _jsx(YAxis, { tickFormatter: (v) => formatAxisTick(Number(v), props.unit) }), _jsx(Tooltip, { formatter: (v) => (typeof v === 'number' ? formatValue(v, props.unit) : String(v)), labelFormatter: (v) => {
                                try {
                                    return new Date(overlayEnabled ? Number(v) : String(v)).toLocaleString();
                                }
                                catch {
                                    return String(v);
                                }
                            } }), _jsx(Line, { type: "monotone", dataKey: "value", stroke: "#3b82f6", strokeWidth: 2, dot: false }), overlayEnabled ? referenceLines : null, overlayEnabled ? referenceAreas : null] }) }))] }));
}
//# sourceMappingURL=MetricsPanel.js.map