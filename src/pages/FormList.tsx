'use client';

import React, { useMemo } from 'react';
import { Plus, Settings, Trash2, Users } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useServerDataTableState } from '@hit/ui-kit/hooks/useServerDataTableState';
import { useForms, useFormMutations } from '../hooks/useForms';

interface Props {
  onNavigate?: (path: string) => void;
}

export function FormList({ onNavigate }: Props) {
  const { Page, Card, Button, DataTable, Alert } = useUi();
  const serverTable = useServerDataTableState({
    tableId: 'forms',
    pageSize: 25,
    initialSort: { sortBy: 'updatedAt', sortOrder: 'desc' },
    sortWhitelist: ['name', 'slug', 'createdAt', 'updatedAt'],
  });

  // Admin mode: list ALL forms for management
  const { data, loading, error, refresh } = useForms({
    page: serverTable.query.page,
    pageSize: serverTable.query.pageSize,
    search: serverTable.query.search,
    sortBy: serverTable.query.sortBy,
    sortOrder: serverTable.query.sortOrder,
    adminMode: true,
  });
  const { deleteForm, loading: mutating } = useFormMutations();

  const navigate = (path: string) => {
    if (!onNavigate) throw new Error('[forms] FormList requires onNavigate for client-side navigation');
    onNavigate(path);
  };

  const rows = useMemo(() => {
    return (data?.items || []).map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      updatedAt: f.updatedAt,
    }));
  }, [data]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete form "${name}"? This will also delete its entries and ACLs.`)) return;
    await deleteForm(id);
    refresh();
  };

  return (
    <Page
      title="Form Builder"
      description="Build and manage form definitions. Use ACLs to control who can access each form."
      actions={
        <Button variant="primary" onClick={() => navigate('/forms/new')}>
          <Plus size={16} className="mr-2" />
          New Form
        </Button>
      }
    >
      {error && (
        <Alert variant="error" title="Error loading forms">
          {error.message}
        </Alert>
      )}

      <Card>
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Name',
              sortable: true,
              render: (_: unknown, row: any) => (
                <button
                  className="font-medium hover:text-blue-500 transition-colors text-left"
                  onClick={() => navigate(`/forms/${row.id}`)}
                >
                  {row.name}
                </button>
              ),
            },
            { key: 'slug', label: 'Slug', sortable: true },
            {
              key: 'actions',
              label: '',
              align: 'right' as const,
              sortable: false,
              hideable: false,
              render: (_: unknown, row: any) => (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${row.id}/entries`)}>
                    <Users size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${row.id}`)}>
                    <Settings size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mutating}
                    onClick={() => handleDelete(row.id as string, row.name as string)}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={rows}
          emptyMessage="No forms yet. Create your first form to get started."
          loading={loading}
          searchable
          total={data?.pagination?.total}
          {...serverTable.dataTable}
          searchDebounceMs={400}
          onRefresh={refresh}
          refreshing={loading}
          tableId="forms"
        />
      </Card>
    </Page>
  );
}

export default FormList;
