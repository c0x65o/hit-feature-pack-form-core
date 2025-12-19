'use client';

import React from 'react';
import { ArrowLeft, Edit, Trash2, ClipboardList, FileText } from 'lucide-react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import { useEntry, useForm, useEntryMutations } from '../hooks/useForms';

interface Props {
  id?: string; // formId
  entryId?: string;
  onNavigate?: (path: string) => void;
}

export function EntryDetail({ id, entryId, onNavigate }: Props) {
  const { Page, Card, Button, Alert } = useUi();
  const formId = id as string;

  const { form, version } = useForm(formId);
  const { entry, loading, error } = useEntry(formId, entryId);
  const { deleteEntry, loading: deleting } = useEntryMutations(formId);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const fields = (version?.fields || [])
    .filter((f) => !f.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (loading) {
    return (
      <Page title="Loading...">
        <Card>
          <div className="py-10">Loading…</div>
        </Card>
      </Page>
    );
  }

  if (error || !entry) {
    return (
      <Page
        title="Entry not found"
        actions={
          <Button variant="secondary" onClick={() => navigate(`/forms/${formId}/entries`)}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        }
      >
        <Alert variant="error" title="Error">
          {error?.message || 'Entry not found'}
        </Alert>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Forms', href: '/forms', icon: <ClipboardList size={14} /> },
    ...(form ? [{ label: form.name, href: `/forms/${formId}`, icon: <FileText size={14} /> }] : []),
    { label: 'Entries', href: `/forms/${formId}/entries` },
    { label: `Entry ${entry.id.slice(0, 8)}` },
  ];

  return (
    <Page
      title={form?.name ? `${form.name} — Entry` : 'Entry'}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => navigate(`/forms/${formId}/entries/${entry.id}/edit`)}>
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) return;
              try {
                await deleteEntry(entry.id);
                navigate(`/forms/${formId}/entries`);
              } catch (err) {
                // Error handling is done by the hook
              }
            }}
            disabled={deleting}
          >
            <Trash2 size={16} className="mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      }
    >
      <Card>
        <div className="space-y-4">
          {fields.map((f) => {
            const v = (entry.data || {})[f.key];
            const isRef = f.type === 'reference';
            const isEntityRef = f.type === 'entity_reference';
            const isUrl = f.type === 'url';
            const isDate = f.type === 'date';
            const isDateTime = f.type === 'datetime';
            return (
              <div key={f.key}>
                <div className="text-sm text-gray-500">{f.label}</div>
                <div className="text-base">
                  {v === undefined || v === null ? (
                    ''
                  ) : isUrl ? (
                    <a className="text-sm hover:text-blue-500 underline" href={String(v)} target="_blank" rel="noreferrer">
                      {String(v)}
                    </a>
                  ) : isDate || isDateTime ? (
                    (() => {
                      try {
                        const date = new Date(String(v));
                        if (!isNaN(date.getTime())) {
                          return isDateTime 
                            ? date.toLocaleString()
                            : date.toLocaleDateString();
                        }
                      } catch {
                        // Fall through to string display
                      }
                      return String(v);
                    })()
                  ) : isRef ? (
                    Array.isArray(v) ? (
                      <div className="flex flex-wrap gap-2">
                        {v.map((r: any, idx: number) => (
                          <a
                            key={`${r?.entryId || idx}-${idx}`}
                            className="text-sm hover:text-blue-500 underline"
                            href={`/forms/${r?.formId || ''}/entries/${r?.entryId || ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              if (r?.formId && r?.entryId) {
                                navigate(`/forms/${r.formId}/entries/${r.entryId}`);
                              }
                            }}
                          >
                            {r?.label || r?.entryId || 'Reference'}
                          </a>
                        ))}
                      </div>
                    ) : typeof v === 'object' ? (
                      <a
                        className="text-sm hover:text-blue-500 underline"
                        href={`/forms/${(v as any).formId}/entries/${(v as any).entryId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          if ((v as any).formId && (v as any).entryId) {
                            navigate(`/forms/${(v as any).formId}/entries/${(v as any).entryId}`);
                          }
                        }}
                      >
                        {(v as any).label || (v as any).entryId}
                      </a>
                    ) : (
                      String(v)
                    )
                  ) : isEntityRef ? (
                    Array.isArray(v) ? (
                      <div className="flex flex-wrap gap-2">
                        {v.map((r: any, idx: number) => (
                          String(r?.entityKind || '') === 'project' && r?.entityId ? (
                            <a
                              key={`${r?.entityId || idx}-${idx}`}
                              className="text-sm hover:text-blue-500 underline"
                              href={`/marketing/projects/${encodeURIComponent(String(r.entityId))}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/marketing/projects/${encodeURIComponent(String(r.entityId))}`);
                              }}
                            >
                              {r?.label || r?.entityId || 'Project'}
                            </a>
                          ) : (
                            <span key={`${r?.entityId || idx}-${idx}`} className="text-sm">
                              {r?.label || r?.entityId || 'Entity'}
                            </span>
                          )
                        ))}
                      </div>
                    ) : typeof v === 'object' ? (
                      String((v as any)?.entityKind || '') === 'project' && (v as any)?.entityId ? (
                        <a
                          className="text-sm hover:text-blue-500 underline"
                          href={`/marketing/projects/${encodeURIComponent(String((v as any).entityId))}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/marketing/projects/${encodeURIComponent(String((v as any).entityId))}`);
                          }}
                        >
                          {(v as any).label || (v as any).entityId}
                        </a>
                      ) : (
                        <span className="text-sm">{(v as any).label || (v as any).entityId}</span>
                      )
                    ) : (
                      String(v)
                    )
                  ) : (
                    String(v)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}

export default EntryDetail;
