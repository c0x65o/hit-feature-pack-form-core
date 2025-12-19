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
export function MetricsPanel(props) {
    const { Card } = useUi();
    const panels = Array.isArray(props.metrics?.panels) ? props.metrics.panels : [];
    if (panels.length === 0)
        return null;
    return (_jsx("div", { className: "space-y-4", children: panels.map((p, idx) => (_jsx(MetricsPanelItem, { entityKind: props.entityKind, entityId: props.entityId, panel: p }, `${p.metricKey}-${idx}`))) }));
}
function MetricsPanelItem(props) {
    const { Card, Alert } = useUi();
    const title = props.panel.title || props.panel.metricKey;
    const bucket = props.panel.bucket || 'day';
    const agg = props.panel.agg || 'sum';
    const days = Number.isFinite(Number(props.panel.days)) ? Number(props.panel.days) : 90;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const { start, end } = useMemo(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        return { start, end };
    }, [days]);
    useEffect(() => {
        let cancelled = false;
        async function run() {
            setLoading(true);
            setError(null);
            try {
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
    }, [props.entityKind, props.entityId, props.panel.metricKey, bucket, agg, start, end, JSON.stringify(props.panel.dimensions || {})]);
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