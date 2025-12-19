'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useEntries, useForm, useEntryMutations } from '../hooks/useForms';

interface Props {
  id?: string; // formId from route param
  onNavigate?: (path: string) => void;
}

export function EntryList({ id, onNavigate }: Props) {
  const { Page, Card, Button, DataTable, Alert } = useUi();
  const formId = id as string;

  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<Array<{ field: string; operator: string; value: any }>>([]);
  const { form, version } = useForm(formId);
  const { data, loading, error, refresh } = useEntries({ formId, page, pageSize: 25 });
  const { deleteEntry, loading: mutating } = useEntryMutations(formId);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const visibleFields = (version?.fields || [])
    .filter((f) => !f.hidden && (f.showInTable !== false))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 10); // increased limit since we have explicit control

  // Handle view filter changes
  const handleViewFiltersChange = useCallback((filters: Array<{ field: string; operator: string; value: any }>) => {
    setActiveFilters(filters);
    // TODO: Apply filters to data fetching when server-side filtering is implemented
  }, []);

  const columns = useMemo(() => {
    const dynamicCols = visibleFields.map((f) => {
      // Map form field types to DataTable filter types
      let filterType: 'string' | 'number' | 'date' | 'boolean' | 'select' = 'string';
      let filterOptions: Array<{ value: string; label: string }> | undefined;

      switch (f.type) {
        case 'number':
          filterType = 'number';
          break;
        case 'date':
        case 'datetime':
          filterType = 'date';
          break;
        case 'checkbox':
          filterType = 'boolean';
          break;
        case 'select':
          filterType = 'select';
          filterOptions = (f.config?.options || []).map((opt: any) => ({
            value: typeof opt === 'string' ? opt : opt.value,
            label: typeof opt === 'string' ? opt : opt.label,
          }));
          break;
      }

      return {
        key: f.key,
        label: f.label,
        sortable: false,
        filterType,
        filterOptions,
        render: (_: unknown, row: any) => {
        const v = row.data?.[f.key];
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
              return f.type === 'datetime' 
                ? date.toLocaleString()
                : date.toLocaleDateString();
            }
          } catch {
            // Fall through to string display
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
      {
        key: 'actions',
        label: '',
        align: 'right' as const,
        sortable: false,
        hideable: false,
        render: (_: unknown, row: any) => (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={(e) => {
              e.stopPropagation();
              navigate(`/forms/${formId}/entries/${row.id}/edit`);
            }}>
              <Edit size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={mutating}
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this entry?')) return;
                await deleteEntry(row.id);
                refresh();
              }}
            >
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </div>
        ),
      },
    ];
  }, [visibleFields, formId, navigate, deleteEntry, refresh, mutating]);

  const rows = useMemo(() => {
    return (data?.items || []).map((e) => ({
      id: e.id,
      data: e.data,
      updatedAt: e.updatedAt,
    }));
  }, [data]);

  return (
    <Page
      title={form?.name || ''}
      description={form?.isPublished ? 'Public entries' : 'Draft entries (owner-only)'}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => navigate(`/forms/${formId}/entries/new`)}>
            <Plus size={16} className="mr-2" />
            New Entry
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" title="Error loading entries">
          {error.message}
        </Alert>
      )}

      <Card>
        <DataTable
          columns={columns as any}
          data={rows}
          emptyMessage="No entries yet"
          loading={loading}
          searchable
          pageSize={25}
          onRowClick={(row) => navigate(`/forms/${formId}/entries/${row.id}`)}
          tableId={`form.${formId}`}
          enableViews={true}
          onViewFiltersChange={handleViewFiltersChange}
        />
      </Card>
    </Page>
  );
}

export default EntryList;
