'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, } from 'recharts';
function getAuthHeaders() {
    if (typeof window === 'undefined')
        return {};
    const token = localStorage.getItem('hit_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function toDateInput(d) {
    return d.toISOString();
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
export function MetricsPanel(props) {
    const { Card, Select, Button, Alert } = useUi();
    const panels = Array.isArray(props.metrics?.panels) ? props.metrics.panels : [];
    if (panels.length === 0)
        return null;
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
                                        ] }), preset === 'custom' && (_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-end", children: [_jsxs("label", { className: "text-sm", children: [_jsx("div", { className: "mb-1 text-muted-foreground", children: "Start" }), _jsx("input", { className: "h-10 px-3 rounded-md border border-gray-300 bg-white text-sm", type: "date", value: customStart, onChange: (e) => setCustomStart(e.target.value) })] }), _jsxs("label", { className: "text-sm", children: [_jsx("div", { className: "mb-1 text-muted-foreground", children: "End" }), _jsx("input", { className: "h-10 px-3 rounded-md border border-gray-300 bg-white text-sm", type: "date", value: customEnd, onChange: (e) => setCustomEnd(e.target.value) })] }), _jsx(Button, { variant: "secondary", onClick: handleApplyCustom, children: "Apply" })] }))] })] }), customError && (_jsx("div", { className: "mt-3", children: _jsx(Alert, { variant: "error", title: "Range error", children: customError }) }))] }), panels.map((p, idx) => (_jsx(MetricsPanelItem, { entityKind: props.entityKind, entityId: props.entityId, panel: p, range: range }, `${p.metricKey}-${idx}`)))] }));
}
function MetricsPanelItem(props) {
    const { Card, Alert } = useUi();
    const title = props.panel.title || props.panel.metricKey;
    const bucket = props.panel.bucket || 'day';
    const agg = props.panel.agg || 'sum';
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const start = props.range?.start;
    const end = props.range?.end;
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
                        entityId: props.entityId,
                        dimensions: props.panel.dimensions || undefined,
                    }),
                });
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    throw new Error(json?.error || `Query failed (${res.status})`);
                }
                const json = await res.json();
                const data = Array.isArray(json?.data) ? json.data : [];
                if (!cancelled)
                    setRows(data);
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
    }, [props.entityKind, props.entityId, props.panel.metricKey, bucket, agg, start?.toISOString(), end?.toISOString(), JSON.stringify(props.panel.dimensions || {})]);
    const chartData = useMemo(() => {
        // Expect rows like { bucket: '2025-01-01T00:00:00.000Z', value: '123.45' }
        return rows
            .map((r) => ({
            bucket: r.bucket ? String(r.bucket) : '',
            value: r.value === null || r.value === undefined ? null : Number(r.value),
        }))
            .filter((r) => r.bucket && Number.isFinite(r.value));
    }, [rows]);
    const latestValue = useMemo(() => {
        if (chartData.length === 0)
            return null;
        return chartData[chartData.length - 1].value;
    }, [chartData]);
    return (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-baseline justify-between gap-4 mb-3", children: [_jsx("div", { className: "text-lg font-semibold", children: title }), _jsx("div", { className: "text-sm text-muted-foreground", children: latestValue === null ? '' : latestValue.toLocaleString() })] }), error ? (_jsx(Alert, { variant: "error", title: "Metrics error", children: error })) : loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : chartData.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No data" })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(LineChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "bucket", tickFormatter: (v) => {
                                try {
                                    const d = new Date(String(v));
                                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                }
                                catch {
                                    return String(v);
                                }
                            } }), _jsx(YAxis, {}), _jsx(Tooltip, { formatter: (v) => (typeof v === 'number' ? v.toLocaleString() : String(v)), labelFormatter: (v) => {
                                try {
                                    return new Date(String(v)).toLocaleString();
                                }
                                catch {
                                    return String(v);
                                }
                            } }), _jsx(Line, { type: "monotone", dataKey: "value", stroke: "#3b82f6", strokeWidth: 2, dot: false })] }) }))] }));
}
//# sourceMappingURL=MetricsPanel.js.map