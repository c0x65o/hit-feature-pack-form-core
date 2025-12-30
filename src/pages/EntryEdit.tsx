'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, ClipboardList, FileText } from 'lucide-react';
import { useUi, useFormSubmit, type BreadcrumbItem } from '@hit/ui-kit';
import { useEntry, useEntryMutations, useForm } from '../hooks/useForms';

interface Props {
  id?: string; // formId
  entryId?: string;
  onNavigate?: (path: string) => void;
}

export function EntryEdit({ id, entryId, onNavigate }: Props) {
  const { Page, Card, Button, Input, TextArea, Select, Alert, Modal } = useUi();
  const formId = id as string;
  const isNew = !entryId || entryId === 'new';

  const { form, version, loading: loadingForm, error: formError } = useForm(formId);
  const { entry, loading: loadingEntry, error: loadError } = useEntry(formId, isNew ? undefined : entryId);
  const { createEntry, updateEntry } = useEntryMutations(formId);
  const { submitting, error, fieldErrors, submit, clearError, setFieldErrors, clearFieldError } = useFormSubmit();

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const fields = useMemo(() => {
    return (version?.fields || [])
      .filter((f) => !f.hidden)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [version]);

  const [data, setData] = useState<Record<string, any>>({});
  const [defaultsInitialized, setDefaultsInitialized] = useState(false);
  
  // Initialize default values for new entries
  useEffect(() => {
    if (isNew && fields.length > 0 && !defaultsInitialized && !entry) {
      const defaults: Record<string, any> = {};
      fields.forEach((f) => {
        if (f.defaultValue !== null && f.defaultValue !== undefined) {
          defaults[f.key] = f.defaultValue;
        }
      });
      if (Object.keys(defaults).length > 0) {
        setData(defaults);
      }
      setDefaultsInitialized(true);
    }
  }, [isNew, fields, entry, defaultsInitialized]);
  const [refPicker, setRefPicker] = useState<{
    open: boolean;
    fieldKey: string | null;
    targetFormId: string | null;
    displayFieldKey: string | null;
    multi: boolean;
  }>({ open: false, fieldKey: null, targetFormId: null, displayFieldKey: null, multi: false });
  const [refSearch, setRefSearch] = useState('');
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refItems, setRefItems] = useState<Array<{ id: string; data: any }>>([]);

  const [entityPicker, setEntityPicker] = useState<{
    open: boolean;
    fieldKey: string | null;
    entityKind: string | null;
    multi: boolean;
  }>({ open: false, fieldKey: null, entityKind: null, multi: false });
  const [entitySearch, setEntitySearch] = useState('');
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [entityItems, setEntityItems] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    if (entry?.data) setData(entry.data as any);
  }, [entry]);

  useEffect(() => {
    const run = async () => {
      if (!refPicker.open || !refPicker.targetFormId) return;
      try {
        setRefLoading(true);
        setRefError(null);
        const qs = new URLSearchParams({
          page: '1',
          pageSize: '25',
          search: refSearch,
        });
        const res = await fetch(`/api/forms/${refPicker.targetFormId}/entries?${qs.toString()}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || res.statusText);
        }
        const json = await res.json();
        setRefItems((json.items || []).map((x: any) => ({ id: x.id, data: x.data })));
      } catch (e: any) {
        setRefError(e?.message || 'Failed to load references');
        setRefItems([]);
      } finally {
        setRefLoading(false);
      }
    };
    run();
  }, [refPicker.open, refPicker.targetFormId, refSearch]);

  useEffect(() => {
    const run = async () => {
      if (!entityPicker.open || !entityPicker.entityKind) return;
      try {
        setEntityLoading(true);
        setEntityError(null);
        setEntityItems([]);

        const qs = new URLSearchParams({
          page: '1',
          pageSize: '25',
          search: entitySearch,
        });

        const kind = String(entityPicker.entityKind || '').trim();
        let url: string;
        let extractRows: (json: any) => any[];
        let toItem: (row: any) => { id: string; label: string };

        if (kind === 'project') {
          url = `/api/projects?${qs.toString()}`;
          extractRows = (json: any) => (Array.isArray(json?.data) ? json.data : []);
          toItem = (p: any) => ({
            id: String(p?.id || ''),
            label: String(p?.slug || p?.name || p?.id || ''),
          });
        } else if (kind === 'crm_contact') {
          url = `/api/crm/contacts?${qs.toString()}`;
          extractRows = (json: any) => (Array.isArray(json?.items) ? json.items : []);
          toItem = (c: any) => ({
            id: String(c?.id || ''),
            label: String(c?.name || c?.email || c?.id || ''),
          });
        } else if (kind === 'crm_company') {
          url = `/api/crm/companies?${qs.toString()}`;
          extractRows = (json: any) => (Array.isArray(json?.items) ? json.items : []);
          toItem = (c: any) => ({
            id: String(c?.id || ''),
            label: String(c?.name || c?.id || ''),
          });
        } else if (kind === 'crm_opportunity') {
          url = `/api/crm/opportunities?${qs.toString()}`;
          extractRows = (json: any) => (Array.isArray(json?.items) ? json.items : []);
          toItem = (o: any) => ({
            id: String(o?.id || ''),
            label: String(o?.name || o?.title || o?.id || ''),
          });
        } else {
          throw new Error(`Unsupported entity kind: ${kind}`);
        }

        const res = await fetch(url, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || res.statusText);
        }
        const json = await res.json();
        const rows = extractRows(json);
        setEntityItems(
          rows
            .map(toItem)
            .filter((x: any) => x.id && x.label),
        );
      } catch (e: any) {
        setEntityError(e?.message || 'Failed to load entities');
        setEntityItems([]);
      } finally {
        setEntityLoading(false);
      }
    };
    run();
  }, [entityPicker.open, entityPicker.entityKind, entitySearch]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required) {
        const v = data[f.key];
        if (v === undefined || v === null || v === '') {
          errs[f.key] = `${f.label} is required`;
        }
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const parseSelectOptions = (f: any): Array<{ value: string; label: string }> => {
    const text = String(f.config?.optionsText || '').trim();
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [value, label] = line.split('|');
        return { value: (value || '').trim(), label: (label || value || '').trim() };
      })
      .filter((o) => o.value);
  };

  const renderField = (f: any) => {
    const v = data[f.key] ?? '';
    const err = fieldErrors[f.key];

    switch (f.type) {
      case 'text':
        return (
          <Input
            key={f.key}
            label={f.label}
            value={String(v)}
            onChange={(val: string) => setData((p) => ({ ...p, [f.key]: val }))}
            required={Boolean(f.required)}
            error={err}
          />
        );
      case 'url':
        return (
          <Input
            key={f.key}
            label={f.label}
            value={String(v)}
            onChange={(val: string) => setData((p) => ({ ...p, [f.key]: val }))}
            required={Boolean(f.required)}
            error={err}
          />
        );
      case 'textarea':
        return (
          <TextArea
            key={f.key}
            label={f.label}
            value={String(v)}
            onChange={(val: string) => setData((p) => ({ ...p, [f.key]: val }))}
            rows={6}
          />
        );
      case 'number':
        return (
          <Input
            key={f.key}
            label={f.label}
            value={v === '' ? '' : String(v)}
            onChange={(val: string) => setData((p) => ({ ...p, [f.key]: val === '' ? '' : Number(val) }))}
            required={Boolean(f.required)}
            error={err}
          />
        );
      case 'date':
        return (
          <Input
            key={f.key}
            label={f.label}
            value={String(v)}
            onChange={(val: string) => setData((p) => ({ ...p, [f.key]: val }))}
            type="date"
          />
        );
      case 'datetime':
        return (
          <Input
            key={f.key}
            label={f.label}
            value={String(v)}
            onChange={(val: string) => setData((p) => ({ ...p, [f.key]: val }))}
            type="datetime-local"
          />
        );
      case 'checkbox':
        return (
          <label key={f.key} className="text-sm flex items-center gap-2 text-gray-900">
            <input
              type="checkbox"
              checked={Boolean(v)}
              onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.checked }))}
              className="w-4 h-4"
            />
            {f.label}
          </label>
        );
      case 'select':
        return (
          <Select
            key={f.key}
            label={f.label}
            value={String(v)}
            onChange={(val: any) => setData((p) => ({ ...p, [f.key]: val }))}
            options={[{ value: '', label: 'Select…' }, ...parseSelectOptions(f)]}
          />
        );
      case 'reference': {
        const refCfg = f.config?.reference || {};
        const targetFormId = String(refCfg.targetFormId || '');
        const displayFieldKey = String(refCfg.displayFieldKey || '');
        const multi = Boolean(refCfg.multi);

        const current = data[f.key];
        const currentList: Array<{ formId: string; entryId: string; label?: string }> = Array.isArray(current)
          ? current
          : current && typeof current === 'object'
            ? [current]
            : [];

        const removeAt = (idx: number) => {
          const next = [...currentList];
          next.splice(idx, 1);
          setData((p) => ({ ...p, [f.key]: multi ? next : (next[0] || null) }));
        };

        return (
          <div key={f.key} className="space-y-2">
            <div className="text-sm font-medium text-gray-700">{f.label}</div>
            {!targetFormId ? (
              <Alert variant="warning" title="Reference field not configured">
                Set a target form + display field key in the form builder.
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {currentList.length === 0 ? (
                    <div className="text-sm text-gray-500">No selection</div>
                  ) : (
                    currentList.map((r, idx) => (
                      <div key={`${r.entryId}-${idx}`} className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 bg-gray-100">
                        <a
                          className="text-sm text-gray-900 hover:text-blue-600 transition-colors"
                          href={`/forms/${r.formId || targetFormId}/entries/${r.entryId}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/forms/${r.formId || targetFormId}/entries/${r.entryId}`);
                          }}
                        >
                          {r.label || r.entryId}
                        </a>
                        <button className="text-xs text-gray-600 hover:text-red-600 transition-colors" onClick={() => removeAt(idx)}>
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setRefPicker({
                      open: true,
                      fieldKey: f.key,
                      targetFormId,
                      displayFieldKey,
                      multi,
                    })
                  }
                >
                  Select…
                </Button>
              </>
            )}
          </div>
        );
      }
      case 'entity_reference': {
        const eCfg = f.config?.entity || {};
        const entityKind = String(eCfg.kind || 'project');
        const multi = Boolean(eCfg.multi);

        const currentEnt = data[f.key];
        const currentEntList: Array<{ entityKind: string; entityId: string; label?: string }> = Array.isArray(currentEnt)
          ? currentEnt
          : currentEnt && typeof currentEnt === 'object'
            ? [currentEnt]
            : [];

        const removeEntAt = (idx: number) => {
          const next = [...currentEntList];
          next.splice(idx, 1);
          setData((p) => ({ ...p, [f.key]: multi ? next : (next[0] || null) }));
        };

        return (
          <div key={f.key} className="space-y-2">
            <div className="text-sm font-medium text-gray-700">{f.label}</div>
            <div className="flex flex-wrap gap-2">
              {currentEntList.length === 0 ? (
                <div className="text-sm text-gray-500">No selection</div>
              ) : (
                currentEntList.map((r, idx) => (
                  <div key={`${r.entityId}-${idx}`} className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 bg-gray-100">
                    <span className="text-sm text-gray-900">{r.label || r.entityId}</span>
                    <button className="text-xs text-gray-600 hover:text-red-600 transition-colors" onClick={() => removeEntAt(idx)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setEntityPicker({
                  open: true,
                  fieldKey: f.key,
                  entityKind,
                  multi,
                })
              }
            >
              Select…
            </Button>
          </div>
        );
      }
      default:
        return (
          <Alert key={f.key} variant="warning" title={f.label}>
            Unsupported field type: {String(f.type)}
          </Alert>
        );
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const result = await submit(async () => {
      if (isNew) {
        const created = await createEntry(data);
        return { id: created.id };
      }

      if (!entryId) throw new Error('Invalid state');
      await updateEntry(entryId, data);
      return { id: entryId };
    });

    if (result && typeof result === 'object' && result !== null) {
      const resultWithId = result as { id?: string };
      if (resultWithId.id) {
        navigate(`/forms/${formId}/entries/${resultWithId.id}`);
      }
    }
  };

  if (loadingForm || (!isNew && loadingEntry)) {
    return (
      <Page title="Loading...">
        <Card>
          <div className="py-10">Loading…</div>
        </Card>
      </Page>
    );
  }

  if (formError) {
    return (
      <Page
        title="Form not found"
        actions={
          <Button variant="secondary" onClick={() => navigate('/forms')}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        }
      >
        <Alert variant="error" title="Error">
          {formError.message}
        </Alert>
      </Page>
    );
  }

  if (!isNew && loadError) {
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
          {loadError.message}
        </Alert>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Forms', href: '/forms', icon: <ClipboardList size={14} /> },
    ...(form ? [{ label: form.name, href: `/forms/${formId}`, icon: <FileText size={14} /> }] : []),
    { label: 'Entries', href: `/forms/${formId}/entries` },
    ...(!isNew && entryId ? [{ label: `Entry ${entryId.slice(0, 8)}`, href: `/forms/${formId}/entries/${entryId}` }] : []),
    { label: isNew ? 'New' : 'Edit' },
  ];

  return (
    <Page
      title={form?.name ? `${isNew ? 'New' : 'Edit'} ${form.name}` : isNew ? 'New Entry' : 'Edit Entry'}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            <Save size={16} className="mr-2" />
            {submitting ? 'Saving...' : (isNew ? 'Create' : 'Save')}
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" title="Error saving" onClose={clearError}>
          {error.message}
        </Alert>
      )}

      {/* Reference picker overlay */}
      <Modal
        open={refPicker.open}
        onClose={() => setRefPicker((p) => ({ ...p, open: false }))}
        title="Select reference"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Search"
            value={refSearch}
            onChange={setRefSearch}
            placeholder="Search…"
          />

          {refError && (
            <Alert variant="error" title="Error">
              {refError}
            </Alert>
          )}

          <div className="max-h-[400px] overflow-y-auto flex flex-col gap-2">
            {refLoading ? (
              <div className="py-4 text-center text-gray-500">Loading…</div>
            ) : refItems.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No results</div>
            ) : (
              refItems.map((item) => {
                const label =
                  refPicker.displayFieldKey && item.data
                    ? item.data[refPicker.displayFieldKey]
                    : null;
                const display = label ? String(label) : item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!refPicker.fieldKey || !refPicker.targetFormId) return;

                      const refObj = {
                        formId: refPicker.targetFormId,
                        entryId: item.id,
                        label: display,
                      };

                      setData((prev) => {
                        const existing = prev[refPicker.fieldKey as string];
                        if (refPicker.multi) {
                          const arr = Array.isArray(existing) ? existing : [];
                          const next = [...arr, refObj];
                          return { ...prev, [refPicker.fieldKey as string]: next };
                        }
                        return { ...prev, [refPicker.fieldKey as string]: refObj };
                      });

                      setRefPicker((p) => ({ ...p, open: false }));
                    }}
                    className="w-full text-left px-3 py-2 border border-gray-300 rounded hover:border-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-sm font-medium mb-1 text-gray-900">{display}</div>
                    <div className="text-xs text-gray-500">{item.id}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Entity picker overlay */}
      <Modal
        open={entityPicker.open}
        onClose={() => setEntityPicker((p) => ({ ...p, open: false }))}
        title={`Select ${entityPicker.entityKind}`}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <Input label="Search" value={entitySearch} onChange={setEntitySearch} placeholder="Search…" />

          {entityError && (
            <Alert variant="error" title="Error">
              {entityError}
            </Alert>
          )}

          <div className="max-h-[400px] overflow-y-auto flex flex-col gap-2">
            {entityLoading ? (
              <div className="py-4 text-center text-gray-500">Loading…</div>
            ) : entityItems.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No results</div>
            ) : (
              entityItems.map((item) => {
                const currentValue = data[entityPicker.fieldKey as string];
                const isSelected = entityPicker.multi
                  ? Array.isArray(currentValue) && currentValue.some((v: any) => v?.entityId === item.id)
                  : currentValue?.entityId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!entityPicker.fieldKey || !entityPicker.entityKind) return;
                      const obj = { entityKind: entityPicker.entityKind, entityId: item.id, label: item.label };
                      setData((prev) => {
                        const existing = prev[entityPicker.fieldKey as string];
                        if (entityPicker.multi) {
                          const arr = Array.isArray(existing) ? existing : [];
                          // Toggle selection for multi
                          const isAlreadySelected = arr.some((v: any) => v?.entityId === item.id);
                          if (isAlreadySelected) {
                            return { ...prev, [entityPicker.fieldKey as string]: arr.filter((v: any) => v?.entityId !== item.id) };
                          }
                          return { ...prev, [entityPicker.fieldKey as string]: [...arr, obj] };
                        }
                        // For single selection, return the selected object
                        return { ...prev, [entityPicker.fieldKey as string]: obj };
                      });
                      // Close modal for single selection
                      if (!entityPicker.multi) {
                        setEntityPicker((p) => ({ ...p, open: false }));
                      }
                    }}
                    className={`w-full text-left px-3 py-2 border rounded transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-100 text-blue-900'
                        : 'border-gray-300 hover:border-blue-600 hover:bg-blue-50 text-gray-900'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">{item.label}</div>
                    <div className={`text-xs ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>{item.id}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <Card>
        <div className="space-y-6">
          {!version ? (
            <Alert variant="warning" title="Form not configured">
              This form has no draft version. Please create a draft version in the form builder.
            </Alert>
          ) : fields.length === 0 ? (
            <Alert variant="warning" title="No fields">
              This form has no fields yet. Add fields in the form builder.
            </Alert>
          ) : (
            fields.map(renderField)
          )}
        </div>
      </Card>
    </Page>
  );
}

export default EntryEdit;
