'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
import { useForms, useFormMutations } from '../hooks/useForms';

interface Props {
  onNavigate?: (path: string) => void;
}

export function FormList({ onNavigate }: Props) {
  const { Page, Card, Button, DataTable, Alert } = useUi();
  const [page, setPage] = useState(1);

  const { data, loading, error, refresh } = useForms({ page, pageSize: 25 });
  const { deleteForm, loading: mutating } = useFormMutations();

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const rows = useMemo(() => {
    return (data?.items || []).map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      isPublished: f.isPublished,
      updatedAt: f.updatedAt,
    }));
  }, [data]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete form "${name}"? This will also delete its entries.`)) return;
    await deleteForm(id);
    refresh();
  };

  return (
    <Page
      title="Forms"
      description="Build and manage runtime forms"
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
              key: 'isPublished',
              label: 'Published',
              sortable: true,
              render: (v: unknown) => (v ? 'Yes' : 'No'),
            },
            {
              key: 'actions',
              label: '',
              align: 'right' as const,
              sortable: false,
              hideable: false,
              render: (_: unknown, row: any) => (
                <div className="flex items-center justify-end gap-2">
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
          emptyMessage="No forms yet"
          loading={loading}
          searchable
          pageSize={25}
        />
      </Card>
    </Page>
  );
}

export default FormList;
