'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { useLinkedFormEntries, useLinkedForms, type LinkedFormInfo, type LinkedEntityKind } from '../hooks/useLinkedEntities';
import { MetricsPanel, type MetricsViewMetadata } from './MetricsPanel';

export interface LinkedEntityTabsProps {
  entity: { kind: LinkedEntityKind; id: string };
  overview: React.ReactNode;
  overviewLabel?: string;
  includeZeroCountTabs?: boolean;
  pageSize?: number;
  onNavigate?: (path: string) => void;
  rowHref?: (args: { formId: string; entryId: string }) => string;
}

function defaultRowHref(args: { formId: string; entryId: string }): string {
  return `/forms/${encodeURIComponent(args.formId)}/entries/${encodeURIComponent(args.entryId)}`;
}

type ViewFilter = {
  field: string;
  operator: string;
  value: string | number | boolean | null;
};

function safeNavigate(path: string, onNavigate?: (path: string) => void) {
  if (onNavigate) return onNavigate(path);
  window.location.href = path;
}

function applyViewFilters<T extends Record<string, unknown>>(rows: T[], filters: ViewFilter[]): T[] {
  if (!filters || filters.length === 0) return rows;

  const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v));

  return rows.filter((row) => {
    return filters.every((f) => {
      const raw = (row as any)?.[f.field];
      const v = raw === undefined ? (row as any)?.data?.[f.field] : raw;
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

export function LinkedEntityTabs({
  entity,
  overview,
  overviewLabel = 'Overview',
  includeZeroCountTabs = true,
  pageSize = 25,
  onNavigate,
  rowHref = defaultRowHref,
}: LinkedEntityTabsProps) {
  const { Tabs, Card, DataTable } = useUi();

  const { items: linkedForms, loading: formsLoading } = useLinkedForms(entity);

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mode, setMode] = useState<'list' | 'metrics'>('list');
  const [page, setPage] = useState(1);
  const [viewFilters, setViewFilters] = useState<ViewFilter[]>([]);

  const visibleLinkedForms = useMemo(() => {
    return includeZeroCountTabs ? linkedForms : linkedForms.filter((f) => f.count > 0);
  }, [linkedForms, includeZeroCountTabs]);

  const selectedFormInfo: LinkedFormInfo | null = useMemo(() => {
    if (activeTab === 'overview') return null;
    return visibleLinkedForms.find((f) => f.formId === activeTab) || null;
  }, [activeTab, visibleLinkedForms]);

  const tabs = useMemo(() => {
    const tabItems: Array<{ id: string; label: string; content: null }> = [
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

  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setMode('list');
      setPage(1);
      setViewFilters([]);
    },
    [setActiveTab]
  );

  const effectivePage = mode === 'metrics' ? 1 : page;
  const effectivePageSize = mode === 'metrics' ? 1000 : pageSize;

  const { data: entriesData, loading: entriesLoading, refresh: refreshEntries } = useLinkedFormEntries(
    activeTab !== 'overview' && selectedFormInfo
      ? {
          formId: selectedFormInfo.formId,
          entity,
          entityFieldKey: selectedFormInfo.entityFieldKey,
          options: { page: effectivePage, pageSize: effectivePageSize },
        }
      : null
  );

  const visibleFields = useMemo(() => {
    return (entriesData?.fields || [])
      .filter((f: any) => !f.hidden && (f.showInTable !== false))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 10);
  }, [entriesData?.fields]);

  const columns = useMemo(() => {
    const dynamicCols = visibleFields.map((f: any) => {
      return {
        key: f.key,
        label: f.label,
        sortable: false,
        render: (_: unknown, row: any) => {
          // Form fields are now flattened onto the row (row.platform instead of row.data.platform)
          const v = row[f.key];
          if (v === undefined || v === null) return '';

          if (f.type === 'url') {
            const s = String(v);
            if (!s.trim()) return '';
            return (
              <a className="text-sm hover:text-blue-500 underline" href={s} target="_blank" rel="noreferrer">
                {s}
              </a>
            );
          }

          if (f.type === 'datetime' || f.type === 'date') {
            try {
              const date = new Date(String(v));
              if (!isNaN(date.getTime())) {
                return f.type === 'datetime' ? date.toLocaleString() : date.toLocaleDateString();
              }
            } catch {
              // fall through
            }
          }

          // Friendly display for reference fields
          if (Array.isArray(v)) {
            return v
              .map((x: any) => x?.label || x?.entryId || x?.entityId || '')
              .filter(Boolean)
              .join(', ');
          }
          if (typeof v === 'object') {
            return (v as any).label || (v as any).entryId || (v as any).entityId || '';
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
        render: (v: unknown) => (v ? new Date(String(v)).toLocaleString() : ''),
      },
    ];
  }, [visibleFields]);

  const rows = useMemo(() => {
    // Flatten form data onto the row so grouping and column access work correctly.
    // Form fields become top-level properties (e.g., row.platform instead of row.data.platform)
    return (entriesData?.items || []).map((e: any) => ({
      id: e.id,
      ...e.data, // Spread form fields onto row for grouping/sorting
      _formData: e.data, // Keep original data for reference if needed
      updatedAt: e.updatedAt,
    }));
  }, [entriesData?.items]);
  
  const filteredRows = useMemo(() => applyViewFilters(rows, viewFilters), [rows, viewFilters]);
  
  const metricsMeta: MetricsViewMetadata | null = useMemo(() => {
    const m = entriesData?.listConfig?.metricsConfig;
    return m && typeof m === 'object' ? (m as MetricsViewMetadata) : null;
  }, [entriesData?.listConfig]);

  const hasMetrics = Boolean(Array.isArray(metricsMeta?.panels) && metricsMeta!.panels!.length > 0);

  return (
    <div>
      {/* Tabs */}
      {tabs.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <Tabs tabs={tabs} value={activeTab} onValueChange={handleTabChange} />
        </div>
      )}

      {/* Content */}
      {activeTab === 'overview' ? (
        <>{overview}</>
      ) : (
        <Card title={selectedFormInfo?.formName || 'Linked Entries'}>
          {!selectedFormInfo ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--hit-muted-foreground, #64748b)' }}>
              Loading form information...
            </div>
          ) : entriesLoading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--hit-muted-foreground, #64748b)' }}>
              Loading entries...
            </div>
          ) : (entriesData?.items || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--hit-muted-foreground, #64748b)' }}>
              No entries found for this {entity.kind}.
            </div>
          ) : (
            <>
              {hasMetrics && (
                <div style={{ marginBottom: 16 }}>
                  <Tabs
                    tabs={[
                      { id: 'list', label: 'List', content: null },
                      { id: 'metrics', label: 'Metrics', content: null },
                    ]}
                    value={mode}
                    onValueChange={(v) => setMode(v as any)}
                  />
                </div>
              )}

              {hasMetrics && mode === 'metrics' ? (
                (() => {
                  // Linked-form metrics are scoped to the linked entries themselves:
                  //   entityKind = `forms_${formSlug}`, entityIds = entry IDs
                  const defaultKind = selectedFormInfo?.formSlug ? `forms_${selectedFormInfo.formSlug}` : entity.kind;
                  const defaultIds = (entriesData?.items || []).map((it: any) => String(it.id)).filter(Boolean);

                  let metricsEntityKind = defaultKind;
                  let metricsEntityIds = defaultIds;

                  if (selectedFormInfo?.formSlug === 'storefronts') {
                    // Storefronts metrics are ingested/scoped to the storefront entry IDs (entity_kind=forms_storefronts).
                    // To reduce unnecessary per-entity queries, prefer Steam storefront entries when available.
                    // Also dedupe by store_id (we historically had duplicate Steam entries for the same app).
                    const steamEntries = (entriesData?.items || []).filter(
                      (it: any) => String(it?.data?.platform || '').toLowerCase() === 'steam'
                    );

                    const byStoreId = new Map<string, Array<{ id: string; storeId: string }>>();
                    for (const it of steamEntries) {
                      const id = String(it?.id || '').trim();
                      const storeId = String((it as any)?.data?.store_id || '').trim();
                      if (!id || !storeId) continue;
                      const arr = byStoreId.get(storeId) || [];
                      arr.push({ id, storeId });
                      byStoreId.set(storeId, arr);
                    }

                    function scoreStorefrontId(id: string, storeId: string): number {
                      // Prefer canonical IDs: entry_storefront_<slug>_steam_<storeId>
                      let score = 0;
                      if (id.startsWith('entry_storefront_')) score += 10;
                      if (id.includes('_steam_')) score += 10;
                      if (id.endsWith(`_steam_${storeId}`)) score += 50;
                      if (id.endsWith(`_${storeId}`)) score += 5;
                      score += Math.min(id.length, 200) / 100; // slight preference for richer IDs over legacy short ones
                      return score;
                    }

                    const dedupedSteamIds: string[] = [];
                    for (const [storeId, entries] of byStoreId.entries()) {
                      const best = entries
                        .slice()
                        .sort((a, b) => scoreStorefrontId(b.id, storeId) - scoreStorefrontId(a.id, storeId))[0];
                      if (best?.id) dedupedSteamIds.push(best.id);
                    }

                    if (dedupedSteamIds.length > 0) metricsEntityIds = dedupedSteamIds;
                  }

                  return (
                    <MetricsPanel
                      entityKind={metricsEntityKind}
                      entityIds={metricsEntityIds}
                      metrics={metricsMeta!}
                    />
                  );
                })()
              ) : (
                <DataTable
                  columns={columns as any}
                  data={filteredRows}
                  emptyMessage="No entries found"
                  loading={entriesLoading || formsLoading}
                  searchable
                  pageSize={pageSize}
                  page={page}
                  total={entriesData?.pagination.total}
                  onPageChange={setPage}
                  manualPagination
                  onRefresh={refreshEntries}
                  refreshing={entriesLoading}
                  tableId={`forms.entries.${selectedFormInfo.formId}`}
                  enableViews={true}
                  onViewFiltersChange={(filters) => setViewFilters(filters as any)}
                  onRowClick={(row: any) => {
                    const href = rowHref({ formId: selectedFormInfo.formId, entryId: String(row.id) });
                    safeNavigate(href, onNavigate);
                  }}
                />
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}


