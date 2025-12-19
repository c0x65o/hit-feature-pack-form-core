'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type MetricsViewMetadata = {
  panels?: Array<{
    title?: string;
    metricKey: string;
    bucket?: Bucket;
    agg?: Agg;
    days?: number; // default window
    dimensions?: Record<string, string | number | boolean | null>;
  }>;
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('hit_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toDateInput(d: Date): string {
  return d.toISOString();
}

export function MetricsPanel(props: {
  entityKind: string;
  entityId: string;
  metrics: MetricsViewMetadata;
}) {
  const { Card } = useUi();

  const panels = Array.isArray(props.metrics?.panels) ? props.metrics.panels : [];
  if (panels.length === 0) return null;

  return (
    <div className="space-y-4">
      {panels.map((p, idx) => (
        <MetricsPanelItem
          key={`${p.metricKey}-${idx}`}
          entityKind={props.entityKind}
          entityId={props.entityId}
          panel={p}
        />
      ))}
    </div>
  );
}

function MetricsPanelItem(props: {
  entityKind: string;
  entityId: string;
  panel: {
    title?: string;
    metricKey: string;
    bucket?: Bucket;
    agg?: Agg;
    days?: number;
    dimensions?: Record<string, string | number | boolean | null>;
  };
}) {
  const { Card, Alert } = useUi();
  const title = props.panel.title || props.panel.metricKey;
  const bucket: Bucket = props.panel.bucket || 'day';
  const agg: Agg = props.panel.agg || 'sum';
  const days = Number.isFinite(Number(props.panel.days)) ? Number(props.panel.days) : 90;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

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
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load metrics');
      } finally {
        if (!cancelled) setLoading(false);
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
      .map((r: any) => ({
        bucket: r.bucket ? String(r.bucket) : '',
        value: r.value === null || r.value === undefined ? null : Number(r.value),
      }))
      .filter((r: any) => r.bucket && Number.isFinite(r.value));
  }, [rows]);

  const latestValue = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData[chartData.length - 1].value as number;
  }, [chartData]);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">
          {latestValue === null ? '' : latestValue.toLocaleString()}
        </div>
      </div>

      {error ? (
        <Alert variant="error" title="Metrics error">
          {error}
        </Alert>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : chartData.length === 0 ? (
        <div className="text-sm text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(v) => {
                try {
                  const d = new Date(String(v));
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch {
                  return String(v);
                }
              }}
            />
            <YAxis />
            <Tooltip
              formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : String(v))}
              labelFormatter={(v) => {
                try {
                  return new Date(String(v)).toLocaleString();
                } catch {
                  return String(v);
                }
              }}
            />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}


