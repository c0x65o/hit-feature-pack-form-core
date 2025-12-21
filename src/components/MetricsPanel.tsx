'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';

type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';

export type MetricsViewMetadata = {
  panels?: Array<{
    title?: string;
    metricKey: string;
    bucket?: Bucket;
    agg?: Agg;
    /** Optional grouping in the UI (collapsible sections). */
    groupKey?: string;
    groupLabel?: string;
    /** Lucide icon name, e.g. "Users", "Heart", "DollarSign". */
    groupIcon?: string;
    /** Optional hex/rgb color for the group icon chip, e.g. "#5865F2" */
    groupColor?: string;
    /** If true, this panel drives the group's header "current" value. */
    groupPrimary?: boolean;
    /**
     * If set, display as a cumulative running total:
     * - range: starts at 0 at the beginning of the selected range
     * - all_time: starts at cumulative total since 2000-01-01 up to the start of range
     */
    cumulative?: 'range' | 'all_time';
    dimensions?: Record<string, string | number | boolean | null>;
    /**
     * When entityKind is "project", overlay project activity timeline on the chart.
     * Defaults to true for project pages (unless explicitly set to false).
     */
    timelineOverlay?: boolean;
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

type RangePreset = '30d' | '60d' | '90d' | '6m' | '1y' | 'all' | 'custom';

type MetricCatalogItem = {
  key: string;
  label?: string;
  unit?: string; // e.g. usd, count
};

function toPascal(s: string): string {
  return String(s || '')
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? String(c).toUpperCase() : ''))
    .replace(/^(.)/, (m) => m.toUpperCase());
}

function resolveLucideIcon(name?: string) {
  const n = String(name || '').trim();
  if (!n) return null;
  const key = toPascal(n);
  const Comp = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[key];
  return Comp || null;
}

const MAX_GROUP_HEADER_CHIPS = 3;

function normalizeCssColor(input?: string): string | null {
  const s = String(input || '').trim();
  if (!s) return null;
  // Allow common safe formats. If it doesn't match, ignore (don't inject arbitrary CSS).
  if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(s)) return s;
  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|0?\.\d+|1(\.0)?)\s*\)$/.test(s)) return s;
  return null;
}

function formatValue(value: number, unit: string | undefined): string {
  if (!Number.isFinite(value)) return '';
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

function formatAxisTick(value: number, unit: string | undefined): string {
  if (!Number.isFinite(value)) return '';
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

function isoDateOnly(d: Date): string {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeRange(preset: RangePreset, customStart?: string, customEnd?: string): { start: Date; end: Date } | null {
  const end = new Date();
  const start = new Date(end);

  if (preset === '30d') start.setDate(start.getDate() - 30);
  else if (preset === '60d') start.setDate(start.getDate() - 60);
  else if (preset === '90d') start.setDate(start.getDate() - 90);
  else if (preset === '6m') start.setDate(start.getDate() - 180);
  else if (preset === '1y') start.setDate(start.getDate() - 365);
  else if (preset === 'all') return { start: new Date('2000-01-01T00:00:00.000Z'), end };
  else {
    // custom
    if (!customStart || !customEnd) return null;
    const s = new Date(`${customStart}T00:00:00.000Z`);
    const e = new Date(`${customEnd}T23:59:59.999Z`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) return null;
    return { start: s, end: e };
  }

  return { start, end };
}

function GroupCurrentValue(props: {
  entityKind: string;
  entityIds: string[];
  metricKey: string;
  end: Date | undefined;
  unit?: string;
  agg?: Agg;
  className?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const end = props.end;
      const ids = props.entityIds;
      if (!end || !props.metricKey || ids.length === 0) {
        if (!cancelled) setValue(null);
        return;
      }
      try {
        if (!cancelled) setLoading(true);
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
          if (!cancelled) setValue(null);
          return;
        }
        const json = await res.json().catch(() => null);
        const v = Array.isArray(json?.data) && json.data[0]?.value != null ? Number(json.data[0].value) : null;
        if (!cancelled) setValue(Number.isFinite(v as any) ? (v as number) : null);
      } catch {
        if (!cancelled) setValue(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [props.entityKind, JSON.stringify(props.entityIds), props.metricKey, props.end?.toISOString(), props.agg]);

  if (loading) return <span className={props.className || 'text-sm text-muted-foreground'}>…</span>;
  if (value === null) return <span className={props.className || 'text-sm text-muted-foreground'}>{props.placeholder || '—'}</span>;
  return <span className={props.className || 'text-sm font-medium'}>{formatValue(value, props.unit)}</span>;
}

export function MetricsPanel(props: {
  entityKind: string;
  entityId?: string;
  entityIds?: string[];
  metrics: MetricsViewMetadata;
}) {
  const { Card, Select, Button, Alert } = useUi();

  const panels = Array.isArray(props.metrics?.panels) ? props.metrics.panels : [];
  if (panels.length === 0) return null;

  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; icon?: string; color?: string; panels: Array<(typeof panels)[number]> }
    >();
    const ungrouped: Array<(typeof panels)[number]> = [];

    for (const p of panels) {
      const gk = typeof (p as any).groupKey === 'string' ? String((p as any).groupKey).trim() : '';
      if (!gk) {
        ungrouped.push(p);
        continue;
      }
      const label =
        typeof (p as any).groupLabel === 'string' && String((p as any).groupLabel).trim()
          ? String((p as any).groupLabel).trim()
          : gk;
      const icon = typeof (p as any).groupIcon === 'string' ? String((p as any).groupIcon).trim() : '';
      const color = typeof (p as any).groupColor === 'string' ? String((p as any).groupColor).trim() : '';

      const existing = groups.get(gk) || { key: gk, label, icon: icon || undefined, color: color || undefined, panels: [] as any[] };
      // Prefer the first non-empty label/icon we see for the group
      if (!existing.label && label) existing.label = label;
      if (!existing.icon && icon) existing.icon = icon;
      if (!existing.color && color) existing.color = color;
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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Global time range selector (default 90d)
  const [preset, setPreset] = useState<RangePreset>('90d');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return isoDateOnly(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => isoDateOnly(new Date()));
  const [customError, setCustomError] = useState<string | null>(null);

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

  const [catalogByKey, setCatalogByKey] = useState<Record<string, MetricCatalogItem>>({});
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const res = await fetch('/api/metrics/catalog', { credentials: 'include', headers: { ...getAuthHeaders() } });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const items: any[] = Array.isArray(json?.items) ? json.items : [];
        const map: Record<string, MetricCatalogItem> = {};
        for (const it of items) {
          if (it && typeof it.key === 'string') map[it.key] = it as MetricCatalogItem;
        }
        if (!cancelled) setCatalogByKey(map);
      } catch {
        // ignore
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-lg font-semibold">Metrics</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Range"
              value={preset}
              onChange={(v: any) => {
                setCustomError(null);
                setPreset(v as RangePreset);
              }}
              options={[
                { value: '30d', label: '30d' },
                { value: '60d', label: '60d' },
                { value: '90d', label: '90d' },
                { value: '6m', label: '6m' },
                { value: '1y', label: '1y' },
                { value: 'all', label: 'All' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            {preset === 'custom' && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="text-sm">
                  <div className="mb-1 text-muted-foreground">Start</div>
                  <input
                    className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-muted-foreground">End</div>
                  <input
                    className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </label>
                <Button variant="secondary" onClick={handleApplyCustom}>
                  Apply
                </Button>
              </div>
            )}
          </div>
        </div>
        {customError && (
          <div className="mt-3">
            <Alert variant="error" title="Range error">
              {customError}
            </Alert>
          </div>
        )}
      </Card>

      {/* Ungrouped panels render as-is */}
      {grouped.ungrouped.map((p, idx) => (
        <MetricsPanelItem
          key={`${p.metricKey}-${idx}`}
          entityKind={props.entityKind}
          entityId={props.entityId}
          entityIds={props.entityIds}
          panel={p}
          range={range}
          unit={catalogByKey[p.metricKey]?.unit}
        />
      ))}

      {/* Grouped panels render as collapsible sections; charts mount only when expanded */}
      {grouped.groups.map((g) => {
        const isOpen = expandedGroups.has(g.key);
        const Icon = resolveLucideIcon(g.icon);
        const chipColor = normalizeCssColor((g as any).color);
        const chevron = isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />;
        const groupEntityIds = (Array.isArray(props.entityIds) && props.entityIds.length > 0
          ? props.entityIds
          : props.entityId
            ? [props.entityId]
            : []) as string[];

        const orderedPanels = g.panels
          .slice()
          .sort((a: any, b: any) => (Boolean(b.groupPrimary) ? 1 : 0) - (Boolean(a.groupPrimary) ? 1 : 0));
        const chipPanels = orderedPanels.slice(0, MAX_GROUP_HEADER_CHIPS);
        const remainingCount = Math.max(0, g.panels.length - chipPanels.length);
        const subtitleNames = orderedPanels
          .slice(0, 2)
          .map((p) => String(p.title || p.metricKey))
          .filter(Boolean);

        return (
          <Card key={`group.${g.key}`}>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-4 text-left"
              onClick={() => toggleGroup(g.key)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-muted-foreground">{chevron}</span>
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={
                    chipColor
                      ? { backgroundColor: `${chipColor}1A`, border: `1px solid ${chipColor}40` }
                      : { backgroundColor: 'var(--hit-muted, rgba(148,163,184,0.18))' }
                  }
                >
                  {Icon ? (
                    <span style={chipColor ? { color: chipColor, display: 'inline-flex' } : { display: 'inline-flex' }}>
                      <Icon size={18} className={chipColor ? undefined : 'text-muted-foreground'} />
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="font-semibold truncate">{g.label}</div>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground shrink-0">
                      {g.panels.length}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {subtitleNames.join(' · ')}
                    {g.panels.length > 2 ? ` · +${g.panels.length - 2}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Metric list pills (name + current value), no special "Current" metric */}
                <div className="hidden lg:flex items-center gap-2">
                  {chipPanels.map((p, idx) => (
                    <div key={`${g.key}.chip.${p.metricKey}.${idx}`} className="px-2 py-1 rounded-full bg-muted/50 text-xs flex items-center gap-2">
                      <span className="text-muted-foreground truncate max-w-[140px]">{String(p.title || p.metricKey)}</span>
                      <GroupCurrentValue
                        entityKind={props.entityKind}
                        entityIds={groupEntityIds}
                        metricKey={p.metricKey}
                        end={range?.end}
                        unit={catalogByKey[p.metricKey]?.unit}
                        agg={(p.agg || 'last') as any}
                        className="text-xs font-semibold tabular-nums"
                        placeholder="—"
                      />
                    </div>
                  ))}
                  {remainingCount > 0 ? (
                    <span className="text-xs text-muted-foreground">+{remainingCount}</span>
                  ) : null}
                </div>
              </div>
            </button>

            {isOpen ? (
              <div className="mt-4 space-y-4">
                {g.panels.map((p, idx) => (
                  <MetricsPanelItem
                    key={`${g.key}.${p.metricKey}.${idx}`}
                    entityKind={props.entityKind}
                    entityId={props.entityId}
                    entityIds={props.entityIds}
                    panel={p}
                    range={range}
                    unit={catalogByKey[p.metricKey]?.unit}
                  />
                ))}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function MetricsPanelItem(props: {
  entityKind: string;
  entityId?: string;
  entityIds?: string[];
  panel: {
    title?: string;
    metricKey: string;
    bucket?: Bucket;
    agg?: Agg;
    cumulative?: 'range' | 'all_time';
    dimensions?: Record<string, string | number | boolean | null>;
    /** Defaults to true for project pages (entityKind=project) unless explicitly set false. */
    timelineOverlay?: boolean;
  };
  range: { start: Date; end: Date } | null;
  unit?: string;
}) {
  const { Card, Alert } = useUi();
  const title = props.panel.title || props.panel.metricKey;
  const bucket: Bucket = props.panel.bucket || 'day';
  const agg: Agg = props.panel.agg || 'sum';
  const cumulative = props.panel.cumulative;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [baseline, setBaseline] = useState<number>(0);
  const [debug, setDebug] = useState<{ entityKind: string; entityIds: string[]; metricKey: string; bucket: string; agg: string; start?: string; end?: string; rows: number } | null>(
    null
  );

  const start = props.range?.start;
  const end = props.range?.end;
  const entityIds = useMemo(() => {
    const ids = Array.isArray(props.entityIds) ? props.entityIds.filter((x) => typeof x === 'string' && x.trim()) : [];
    if (ids.length > 0) return ids;
    return props.entityId ? [props.entityId] : [];
  }, [props.entityIds, props.entityId]);

  const overlayEnabled = props.entityKind === 'project' && entityIds.length === 1 && props.panel.timelineOverlay !== false;
  const [timelineEvents, setTimelineEvents] = useState<
    Array<{ id: string; title: string; typeColor?: string | null; occurredAt: string; endAt?: string | null }>
  >([]);

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
          if (!cancelled) setBaseline(0);
          return;
        }
        const json = await res.json().catch(() => null);
        const v = Array.isArray(json?.data) && json.data[0]?.value != null ? Number(json.data[0].value) : 0;
        if (!cancelled) setBaseline(Number.isFinite(v) ? v : 0);
      } catch {
        if (!cancelled) setBaseline(0);
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
          .map((r: any) => ({
            bucket: r?.bucket ? String(r.bucket) : '',
            value: r?.value === null || r?.value === undefined ? null : Number(r.value),
          }))
          .filter((r: any) => r.bucket && Number.isFinite(r.value))
          .sort((a: any, b: any) => String(a.bucket).localeCompare(String(b.bucket)));

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
        if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
        const items = Array.isArray(json?.data) ? json.data : [];
        const mapped = items
          .map((a: any) => ({
            id: String(a.id || ''),
            title: String(a.title || a.description || a.activityType || 'Activity'),
            typeColor: a?.activityTypeRecord?.color || null,
            occurredAt: String(a.occurredAt || a.createdAt || ''),
            endAt: a?.endAt ? String(a.endAt) : null,
          }))
          .filter((x: any) => x.id && x.occurredAt);
        if (!cancelled) setTimelineEvents(mapped);
      } catch {
        if (!cancelled) setTimelineEvents([]);
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
      .map((r: any) => ({
        bucket: r.bucket ? String(r.bucket) : '',
        value: r.value === null || r.value === undefined ? null : Number(r.value),
      }))
      .filter((r: any) => r.bucket && Number.isFinite(r.value));
    if (!cumulative) return base;
    let running = cumulative === 'all_time' ? baseline : 0;
    return base.map((r: any) => {
      running += Number(r.value);
      return { ...r, value: running };
    });
  }, [rows, cumulative, baseline]);

  const chartDataWithTs = useMemo(() => {
    if (!overlayEnabled) return chartData;
    return chartData
      .map((d: any) => {
        const ts = d.bucket ? new Date(String(d.bucket)).getTime() : NaN;
        return { ...d, _ts: Number.isFinite(ts) ? ts : null };
      })
      .filter((d: any) => d._ts != null);
  }, [chartData, overlayEnabled]);

  const { referenceLines, referenceAreas } = useMemo(() => {
    if (!overlayEnabled || chartDataWithTs.length === 0 || timelineEvents.length === 0) {
      return { referenceLines: [] as React.ReactNode[], referenceAreas: [] as React.ReactNode[] };
    }
    const ts = chartDataWithTs.map((d: any) => Number(d._ts)).filter((n: any) => Number.isFinite(n));
    if (ts.length === 0) return { referenceLines: [] as React.ReactNode[], referenceAreas: [] as React.ReactNode[] };
    const minTs = Math.min(...ts);
    const maxTs = Math.max(...ts);

    const lines: React.ReactNode[] = [];
    const areas: React.ReactNode[] = [];

    for (const ev of timelineEvents) {
      const startTs = new Date(ev.occurredAt).getTime();
      if (!Number.isFinite(startTs)) continue;
      const endTs = ev.endAt ? new Date(ev.endAt).getTime() : null;
      const color = ev.typeColor || '#6b7280';
      const intersects = endTs ? !(endTs < minTs || startTs > maxTs) : startTs >= minTs && startTs <= maxTs;
      if (!intersects) continue;

      if (endTs && endTs > startTs) {
        areas.push(
          <ReferenceArea
            key={`area_${ev.id}`}
            x1={Math.max(minTs, startTs)}
            x2={Math.min(maxTs, endTs)}
            fill={color}
            fillOpacity={0.10}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        );
      } else {
        lines.push(
          <ReferenceLine
            key={`line_${ev.id}`}
            x={startTs}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="4 2"
            strokeOpacity={0.7}
          />
        );
      }
    }

    return { referenceLines: lines, referenceAreas: areas };
  }, [overlayEnabled, chartDataWithTs, timelineEvents]);

  const rangeTotal = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const s = rows.reduce((acc: number, r: any) => acc + (r?.value == null ? 0 : Number(r.value)), 0);
    return Number.isFinite(s) ? s : null;
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
          {latestValue === null ? '' : formatValue(latestValue, props.unit)}
        </div>
      </div>
      {cumulative && rangeTotal !== null && (
        <div className="text-xs text-muted-foreground mb-2">
          {cumulative === 'range'
            ? `Range total: ${formatValue(rangeTotal, props.unit)}`
            : `Range total: ${formatValue(rangeTotal, props.unit)} · All-time: ${formatValue((baseline || 0) + rangeTotal, props.unit)}`}
        </div>
      )}

      {error ? (
        <Alert variant="error" title="Metrics error">
          {error}
        </Alert>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : chartData.length === 0 ? (
        <>
          <div className="text-sm text-muted-foreground">No data</div>
          {debug && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">Debug</summary>
              <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(debug, null, 2)}</div>
            </details>
          )}
        </>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={overlayEnabled ? chartDataWithTs : chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={overlayEnabled ? '_ts' : 'bucket'}
              type={overlayEnabled ? 'number' : undefined}
              scale={overlayEnabled ? 'time' : undefined}
              domain={overlayEnabled ? ['dataMin', 'dataMax'] : undefined}
              tickFormatter={(v) => {
                try {
                  const d = new Date(overlayEnabled ? Number(v) : String(v));
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch {
                  return String(v);
                }
              }}
            />
            <YAxis tickFormatter={(v: any) => formatAxisTick(Number(v), props.unit)} />
            <Tooltip
              formatter={(v: any) => (typeof v === 'number' ? formatValue(v, props.unit) : String(v))}
              labelFormatter={(v) => {
                try {
                  return new Date(overlayEnabled ? Number(v) : String(v)).toLocaleString();
                } catch {
                  return String(v);
                }
              }}
            />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            {/* Timeline overlays must be direct children of LineChart */}
            {overlayEnabled ? referenceLines : null}
            {overlayEnabled ? referenceAreas : null}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}



