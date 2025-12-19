'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, UploadCloud, ClipboardList, FileText, Share2, Eye, Star, Trash2, Edit2 } from 'lucide-react';
import { useUi, useTableView, type BreadcrumbItem, type TableView, type TableViewFilter } from '@hit/ui-kit';
import {
  FieldType,
  useForms,
  useForm,
  useFormMutations,
} from '../hooks/useForms';
import { FormAclModal } from '../components/FormAclModal';

interface Props {
  id?: string;
  onNavigate?: (path: string) => void;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function FormBuilder({ id, onNavigate }: Props) {
  const { Page, Card, Button, Input, TextArea, Select, Alert } = useUi();
  const isNew = !id || id === 'new';

  const { form, version, loading: loadingForm, error: loadError, refresh } = useForm(isNew ? undefined : id);
  const { createForm, publishForm, unpublishForm, saveForm, loading: saving, error: saveError } = useFormMutations();
  const { data: allForms } = useForms({ page: 1, pageSize: 200 });
  
  // Table views for entries list
  const tableId = id && !isNew ? `form.${id}` : '';
  const { 
    views, 
    loading: viewsLoading, 
    available: viewsAvailable,
    createView, 
    updateView, 
    deleteView,
    refresh: refreshViews,
  } = useTableView({ tableId });

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  // Nav config
  const [navShow, setNavShow] = useState(true);
  const [navPlacement, setNavPlacement] = useState<'under_forms' | 'top_level' | 'custom'>('under_forms');
  const [navGroup, setNavGroup] = useState('main');
  const [navWeight, setNavWeight] = useState<number>(500);
  const [navLabel, setNavLabel] = useState('');
  const [navIcon, setNavIcon] = useState('');
  const [navParentPath, setNavParentPath] = useState('');
  const [availableNavPaths, setAvailableNavPaths] = useState<Array<{ path: string; label: string; depth: number }>>([]);

  const [fields, setFields] = useState<any[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showAclModal, setShowAclModal] = useState(false);
  
  // Views configuration - for managing list views
  const [showViewBuilder, setShowViewBuilder] = useState(false);
  const [editingView, setEditingView] = useState<TableView | null>(null);
  const [viewBuilderName, setViewBuilderName] = useState('');
  const [viewBuilderDescription, setViewBuilderDescription] = useState('');
  const [viewBuilderFilters, setViewBuilderFilters] = useState<TableViewFilter[]>([]);
  const [viewBuilderIsDefault, setViewBuilderIsDefault] = useState(false);
  const [viewBuilderSaving, setViewBuilderSaving] = useState(false);

  // Fetch available nav paths for tree picker
  useEffect(() => {
    async function loadNavPaths() {
      try {
        const res = await fetch('/api/nav-tree');
        if (res.ok) {
          const data = await res.json();
          setAvailableNavPaths(data.paths || []);
        }
      } catch {
        // Nav tree API not available, use static fallback
        setAvailableNavPaths([
          { path: '/marketing', label: 'Marketing', depth: 0 },
          { path: '/marketing/projects', label: 'Marketing → Projects', depth: 1 },
          { path: '/marketing/setup', label: 'Marketing → Setup', depth: 1 },
          { path: '/music', label: 'Music', depth: 0 },
        ]);
      }
    }
    loadNavPaths();
  }, []);

  useEffect(() => {
    if (form) {
      setName(form.name);
      setSlug(form.slug);
      setDescription(form.description || '');
      setNavShow(form.navShow ?? true);
      // Determine placement from navParentPath
      if (form.navParentPath) {
        setNavPlacement('custom');
        setNavParentPath(form.navParentPath);
      } else if (form.navPlacement === 'top_level') {
        setNavPlacement('top_level');
      } else {
        setNavPlacement('under_forms');
      }
      setNavGroup(form.navGroup || 'main');
      setNavWeight(typeof form.navWeight === 'number' ? form.navWeight : 500);
      setNavLabel(form.navLabel || '');
      setNavIcon(form.navIcon || '');
    }
    if (version?.fields) {
      const sorted = [...version.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setFields(sorted);
    }
  }, [form, version]);

  const addField = () => {
    const nextOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order || 0)) + 10 : 10;
    setFields((prev) => [
      ...prev,
      {
        id: `tmp_${Math.random().toString(16).slice(2)}`,
        key: `field_${prev.length + 1}`,
        label: `Field ${prev.length + 1}`,
        type: 'text' as FieldType,
        order: nextOrder,
        required: false,
        hidden: false,
        config: {},
        defaultValue: null,
      },
    ]);
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = [...fields];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    const a = next[idx];
    const b = next[swapIdx];
    next[idx] = b;
    next[swapIdx] = a;
    // normalize order
    next.forEach((f, i) => (f.order = (i + 1) * 10));
    setFields(next);
  };

  const removeField = (idx: number) => {
    const next = [...fields];
    next.splice(idx, 1);
    next.forEach((f, i) => (f.order = (i + 1) * 10));
    setFields(next);
  };

  const handleSave = async () => {
    setLocalError(null);
    if (!name.trim()) {
      setLocalError('Name is required');
      return;
    }

    if (isNew) {
      try {
        const created = await createForm({
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          description: description.trim() || undefined,
          navShow,
          navPlacement: navPlacement === 'custom' ? 'under_forms' : navPlacement,
          navGroup,
          navWeight,
          navLabel: navLabel.trim() || undefined,
          navIcon: navIcon.trim() || undefined,
          navParentPath: navPlacement === 'custom' ? navParentPath : undefined,
        });
        navigate(`/forms/${created.id}`);
        return;
      } catch (e: any) {
        setLocalError(e?.message || 'Failed to create form');
        return;
      }
    }

    if (!id) return;

    try {
      await saveForm(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        navShow,
        navPlacement: navPlacement === 'custom' ? 'under_forms' : navPlacement,
        navGroup,
        navWeight,
        navLabel: navLabel.trim() || undefined,
        navIcon: navIcon.trim() || undefined,
        navParentPath: navPlacement === 'custom' ? navParentPath : null,
        draft: { fields },
      } as any);
      await refresh();
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to save form');
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    if (!confirm('Publish this form? Changes will become visible to users.')) return;
    try {
      await publishForm(id);
      await refresh();
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to publish');
    }
  };

  const handleUnpublish = async () => {
    if (!id) return;
    if (!confirm('Unpublish this form? It will be removed from navigation for other users.')) return;
    try {
      await unpublishForm(id);
      await refresh();
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to unpublish');
    }
  };

  if (!isNew && loadingForm) {
    return (
      <Page title="Loading...">
        <Card>
          <div className="py-10">Loading…</div>
        </Card>
      </Page>
    );
  }

  if (!isNew && loadError) {
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
          {loadError.message}
        </Alert>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Forms', href: '/forms', icon: <ClipboardList size={14} /> },
    ...(!isNew && form ? [{ label: form.name, icon: <FileText size={14} /> }] : []),
    { label: isNew ? 'New' : 'Edit' },
  ];

  return (
    <Page
      title={isNew ? 'New Form' : `Edit Form`}
      description={isNew ? 'Create a new runtime form' : form?.isPublished ? 'Published form' : 'Draft form'}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="secondary" onClick={() => navigate(`/forms/${id}/entries`)}>
              View Entries
            </Button>
          )}
          {!isNew && (
            <Button variant="secondary" onClick={() => setShowAclModal(true)}>
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
          )}
          {!isNew && (
            form?.isPublished ? (
              <Button variant="secondary" onClick={handleUnpublish} disabled={saving}>
                Unpublish
              </Button>
            ) : (
              <Button variant="secondary" onClick={handlePublish} disabled={saving}>
                <UploadCloud size={16} className="mr-2" />
                Publish
              </Button>
            )
          )}
          <Button variant="primary" onClick={() => handleSave()} disabled={saving}>
            <Save size={16} className="mr-2" />
            Save
          </Button>
        </div>
      }
    >
      {(saveError || localError) && (
        <Alert variant="error" title="Error saving">
          {localError || saveError?.message}
        </Alert>
      )}

      <Card>
        <div className="space-y-6">
          <Input label="Name" value={name} onChange={setName} placeholder="e.g. Customer Intake" required />
          <Input label="Slug" value={slug} onChange={setSlug} placeholder="e.g. customer-intake" />
          <TextArea label="Description" value={description} onChange={setDescription} rows={3} />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="text-lg font-semibold">Sharing & Access</div>
          <p className="text-sm text-gray-500">
            Only you can access this form unless you add others below. Admins can always access all forms.
          </p>
          {isNew ? (
            <p className="text-sm text-amber-600">
              Save the form first to configure access permissions.
            </p>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setShowAclModal(true)}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Manage Access
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-6">
          <div className="text-lg font-semibold">Navigation</div>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={navShow}
              onChange={(e) => setNavShow(e.target.checked)}
            />
            Show in navigation when published
          </label>
          <Select
            label="Placement"
            value={navPlacement}
            onChange={(v: any) => {
              setNavPlacement(v);
              if (v !== 'custom') setNavParentPath('');
            }}
            options={[
              { value: 'under_forms', label: 'Inside Custom Forms section' },
              { value: 'top_level', label: 'Top-level (root sidebar)' },
              { value: 'custom', label: 'Nested under existing nav item...' },
            ]}
          />
          {navPlacement === 'custom' && (
            <Select
              label="Parent Nav Item"
              value={navParentPath}
              onChange={(v: any) => setNavParentPath(String(v))}
              options={[
                { value: '', label: '— Select parent —' },
                ...availableNavPaths.map((p) => ({
                  value: p.path,
                  label: '  '.repeat(p.depth) + p.label,
                })),
              ]}
            />
          )}
          <Select
            label="Group"
            value={navGroup}
            onChange={(v: any) => setNavGroup(String(v))}
            options={[
              { value: 'main', label: 'Main' },
              { value: 'system', label: 'System' },
            ]}
          />
          <Input
            label="Weight"
            value={String(navWeight)}
            onChange={(v: string) => setNavWeight(Number(v) || 500)}
            placeholder="Lower shows higher (default 500)"
          />
          <Input
            label="Nav label override"
            value={navLabel}
            onChange={setNavLabel}
            placeholder="Leave empty to use form name"
          />
          <Input
            label="Icon (Lucide name)"
            value={navIcon}
            onChange={setNavIcon}
            placeholder="e.g. FileText (optional)"
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">Fields</div>
            <div className="text-sm text-gray-500">Order is applied to list/detail/edit screens</div>
          </div>
          <Button variant="secondary" onClick={addField}>
            <Plus size={16} className="mr-2" />
            Add Field
          </Button>
        </div>

        <div className="space-y-4">
          {fields.length === 0 && (
            <div className="text-sm text-gray-500">No fields yet. Add your first field.</div>
          )}

          {fields.map((f, idx) => (
            <div key={f.id} className="border border-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input label="Key" value={f.key} onChange={(v: string) => {
                  const next = [...fields];
                  next[idx] = { ...next[idx], key: v };
                  setFields(next);
                }} />
                <Input label="Label" value={f.label} onChange={(v: string) => {
                  const next = [...fields];
                  next[idx] = { ...next[idx], label: v };
                  setFields(next);
                }} />
                <Select
                  label="Type"
                  value={f.type}
                  onChange={(v: any) => {
                    const next = [...fields];
                    next[idx] = { ...next[idx], type: v };
                    setFields(next);
                  }}
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'url', label: 'URL' },
                    { value: 'textarea', label: 'Textarea' },
                    { value: 'number', label: 'Number' },
                    { value: 'date', label: 'Date' },
                    { value: 'datetime', label: 'DateTime' },
                    { value: 'select', label: 'Select' },
                    { value: 'checkbox', label: 'Checkbox' },
                    { value: 'reference', label: 'Reference' },
                    { value: 'entity_reference', label: 'Entity Reference' },
                  ]}
                />
              </div>

              {/* Default Value Input - Dynamic by Type */}
              {(() => {
                const renderDefaultValue = () => {
                  const currentDefault = f.defaultValue;
                  
                  switch (f.type) {
                    case 'text':
                    case 'url':
                    case 'textarea':
                      return (
                        <Input
                          label="Default value (optional)"
                          value={currentDefault != null ? String(currentDefault) : ''}
                          onChange={(v: string) => {
                            const next = [...fields];
                            next[idx] = { ...next[idx], defaultValue: v || null };
                            setFields(next);
                          }}
                          placeholder="Enter default value"
                        />
                      );
                    case 'number':
                      return (
                        <Input
                          label="Default value (optional)"
                          value={currentDefault != null ? String(currentDefault) : ''}
                          onChange={(v: string) => {
                            const next = [...fields];
                            next[idx] = { ...next[idx], defaultValue: v ? Number(v) : null };
                            setFields(next);
                          }}
                          placeholder="Enter default number"
                        />
                      );
                    case 'date':
                      return (
                        <Input
                          label="Default value (optional)"
                          value={currentDefault != null ? String(currentDefault) : ''}
                          onChange={(v: string) => {
                            const next = [...fields];
                            next[idx] = { ...next[idx], defaultValue: v || null };
                            setFields(next);
                          }}
                          placeholder="YYYY-MM-DD"
                        />
                      );
                    case 'datetime':
                      return (
                        <Input
                          label="Default value (optional)"
                          value={currentDefault != null ? String(currentDefault) : ''}
                          onChange={(v: string) => {
                            const next = [...fields];
                            next[idx] = { ...next[idx], defaultValue: v || null };
                            setFields(next);
                          }}
                          placeholder="YYYY-MM-DDTHH:mm"
                        />
                      );
                    case 'select': {
                      const optionsText = String(f.config?.optionsText || '');
                      const options = optionsText
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [value] = line.split('|');
                          return { value: (value || '').trim(), label: line.trim() };
                        })
                        .filter((o) => o.value);
                      
                      return (
                        <Select
                          label="Default value (optional)"
                          value={currentDefault != null ? String(currentDefault) : ''}
                          onChange={(v: any) => {
                            const next = [...fields];
                            next[idx] = { ...next[idx], defaultValue: v || null };
                            setFields(next);
                          }}
                          options={[
                            { value: '', label: '— No default —' },
                            ...options,
                          ]}
                        />
                      );
                    }
                    case 'checkbox':
                      return (
                        <label className="text-sm flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(currentDefault)}
                            onChange={(e) => {
                              const next = [...fields];
                              next[idx] = { ...next[idx], defaultValue: e.target.checked };
                              setFields(next);
                            }}
                          />
                          Default checked
                        </label>
                      );
                    case 'reference':
                    case 'entity_reference':
                      return (
                        <div className="text-sm text-gray-500">
                          Default values for references are not supported.
                        </div>
                      );
                    default:
                      return null;
                  }
                };
                
                return (
                  <div className="border-t border-gray-700 pt-3">
                    {renderDefaultValue()}
                  </div>
                );
              })()}

              <div className="flex items-center gap-3">
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(f.required)}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...next[idx], required: e.target.checked };
                      setFields(next);
                    }}
                  />
                  Required
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(f.hidden)}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...next[idx], hidden: e.target.checked };
                      setFields(next);
                    }}
                  />
                  Hidden
                </label>

                <div className="flex-1" />

                <Button variant="ghost" size="sm" onClick={() => moveField(idx, -1)}>
                  Up
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveField(idx, 1)}>
                  Down
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeField(idx)}>
                  Remove
                </Button>
              </div>

              {f.type === 'select' && (
                <TextArea
                  label="Select options (one per line: value|label)"
                  value={String(f.config?.optionsText || '')}
                  onChange={(v: string) => {
                    const next = [...fields];
                    next[idx] = { ...next[idx], config: { ...(next[idx].config || {}), optionsText: v } };
                    setFields(next);
                  }}
                  rows={3}
                />
              )}

              {f.type === 'reference' && (
                <div className="space-y-3">
                  <Select
                    label="Target form"
                    value={String(f.config?.reference?.targetFormId || '')}
                    onChange={(v: any) => {
                      const next = [...fields];
                      const prevCfg = next[idx].config || {};
                      next[idx] = {
                        ...next[idx],
                        config: {
                          ...prevCfg,
                          reference: {
                            ...(prevCfg.reference || {}),
                            targetFormId: v,
                          },
                        },
                      };
                      setFields(next);
                    }}
                    options={[
                      { value: '', label: 'Select target form…' },
                      ...(allForms?.items || [])
                        .filter((x: any) => !id || x.id !== id)
                        .map((x: any) => ({
                          value: x.id,
                          label: `${x.name} (${x.slug})`,
                        })),
                    ]}
                  />
                  <Input
                    label="Display field key"
                    value={String(f.config?.reference?.displayFieldKey || '')}
                    onChange={(v: string) => {
                      const next = [...fields];
                      const prevCfg = next[idx].config || {};
                      next[idx] = {
                        ...next[idx],
                        config: {
                          ...prevCfg,
                          reference: {
                            ...(prevCfg.reference || {}),
                            displayFieldKey: v,
                          },
                        },
                      };
                      setFields(next);
                    }}
                    placeholder="e.g. name"
                  />
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(f.config?.reference?.multi)}
                      onChange={(e) => {
                        const next = [...fields];
                        const prevCfg = next[idx].config || {};
                        next[idx] = {
                          ...next[idx],
                          config: {
                            ...prevCfg,
                            reference: {
                              ...(prevCfg.reference || {}),
                              multi: e.target.checked,
                            },
                          },
                        };
                        setFields(next);
                      }}
                    />
                    Allow multiple selections
                  </label>
                  <div className="text-xs text-gray-500">
                    Stored as <code>{'{ formId, entryId, label }'}</code> (or an array if multi).
                  </div>
                </div>
              )}

              {f.type === 'entity_reference' && (
                <div className="space-y-3">
                  <Select
                    label="Entity kind"
                    value={String(f.config?.entity?.kind || 'project')}
                    onChange={(v: any) => {
                      const next = [...fields];
                      const prevCfg = next[idx].config || {};
                      next[idx] = {
                        ...next[idx],
                        config: {
                          ...prevCfg,
                          entity: {
                            ...(prevCfg.entity || {}),
                            kind: v || 'project',
                          },
                        },
                      };
                      setFields(next);
                    }}
                    options={[
                      { value: 'project', label: 'Project' },
                    ]}
                  />
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(f.config?.entity?.multi)}
                      onChange={(e) => {
                        const next = [...fields];
                        const prevCfg = next[idx].config || {};
                        next[idx] = {
                          ...next[idx],
                          config: {
                            ...prevCfg,
                            entity: {
                              ...(prevCfg.entity || {}),
                              multi: e.target.checked,
                            },
                          },
                        };
                        setFields(next);
                      }}
                    />
                    Allow multiple
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Views Configuration Card */}
      {!isNew && viewsAvailable && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Eye size={20} />
                Views
              </div>
              <div className="text-sm text-gray-500">
                Configure saved views for the entries list. Views let users filter and organize data.
              </div>
            </div>
            <Button variant="secondary" onClick={() => {
              setEditingView(null);
              setViewBuilderName('');
              setViewBuilderDescription('');
              setViewBuilderFilters([]);
              setViewBuilderIsDefault(false);
              setShowViewBuilder(true);
            }}>
              <Plus size={16} className="mr-2" />
              Add View
            </Button>
          </div>

          <div className="space-y-2">
            {viewsLoading && (
              <div className="text-sm text-gray-500">Loading views...</div>
            )}
            {!viewsLoading && views.length === 0 && (
              <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-600 rounded-lg text-center">
                No views configured. Users can still create their own personal views from the entries list.
              </div>
            )}
            {views.map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between p-3 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {view.isDefault && (
                    <Star size={16} className="text-yellow-500" />
                  )}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {view.name}
                      {view.isSystem && (
                        <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded">System</span>
                      )}
                    </div>
                    {view.description && (
                      <div className="text-sm text-gray-500">{view.description}</div>
                    )}
                    {view.filters && view.filters.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {view.filters.length} filter{view.filters.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                {!view.isSystem && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingView(view);
                        setViewBuilderName(view.name);
                        setViewBuilderDescription(view.description || '');
                        setViewBuilderFilters(view.filters || []);
                        setViewBuilderIsDefault(view.isDefault);
                        setShowViewBuilder(true);
                      }}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!confirm(`Delete view "${view.name}"?`)) return;
                        try {
                          await deleteView(view.id);
                          refreshViews();
                        } catch (err: any) {
                          alert(err?.message || 'Failed to delete view');
                        }
                      }}
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* View Builder Modal */}
      {showViewBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingView ? 'Edit View' : 'Create New View'}
            </h2>
            
            <div className="space-y-4">
              <Input
                label="View Name"
                value={viewBuilderName}
                onChange={setViewBuilderName}
                placeholder="e.g., Active Items, Recent Entries"
              />
              
              <TextArea
                label="Description (optional)"
                value={viewBuilderDescription}
                onChange={setViewBuilderDescription}
                placeholder="Describe what this view shows"
              />
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Filters</label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const firstField = fields[0];
                      setViewBuilderFilters([
                        ...viewBuilderFilters,
                        {
                          field: firstField?.key || '',
                          operator: 'equals',
                          value: '',
                          valueType: 'string',
                          sortOrder: viewBuilderFilters.length,
                        },
                      ]);
                    }}
                  >
                    <Plus size={14} className="mr-1" />
                    Add Filter
                  </Button>
                </div>
                
                {viewBuilderFilters.length === 0 && (
                  <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-600 rounded-lg text-center">
                    No filters. This view will show all entries.
                  </div>
                )}
                
                {viewBuilderFilters.map((filter, idx) => {
                  const fieldDef = fields.find((f) => f.key === filter.field);
                  return (
                    <div key={idx} className="flex items-center gap-2 p-3 border border-gray-700 rounded-lg mb-2">
                      <Select
                        value={filter.field}
                        onChange={(v: string) => {
                          const next = [...viewBuilderFilters];
                          next[idx] = { ...next[idx], field: v };
                          setViewBuilderFilters(next);
                        }}
                        options={fields.map((f) => ({ value: f.key, label: f.label }))}
                      />
                      <Select
                        value={filter.operator}
                        onChange={(v: string) => {
                          const next = [...viewBuilderFilters];
                          next[idx] = { ...next[idx], operator: v };
                          setViewBuilderFilters(next);
                        }}
                        options={[
                          { value: 'equals', label: 'Equals' },
                          { value: 'notEquals', label: 'Not Equals' },
                          { value: 'contains', label: 'Contains' },
                          { value: 'isNull', label: 'Is Empty' },
                          { value: 'isNotNull', label: 'Is Not Empty' },
                        ]}
                      />
                      {!['isNull', 'isNotNull'].includes(filter.operator) && (
                        fieldDef?.type === 'select' && fieldDef?.config?.options ? (
                          <Select
                            value={String(filter.value || '')}
                            onChange={(v: string) => {
                              const next = [...viewBuilderFilters];
                              next[idx] = { ...next[idx], value: v };
                              setViewBuilderFilters(next);
                            }}
                            options={(fieldDef.config.options || []).map((opt: any) => ({
                              value: typeof opt === 'string' ? opt : opt.value,
                              label: typeof opt === 'string' ? opt : opt.label,
                            }))}
                          />
                        ) : (
                          <Input
                            value={String(filter.value || '')}
                            onChange={(v: string) => {
                              const next = [...viewBuilderFilters];
                              next[idx] = { ...next[idx], value: v };
                              setViewBuilderFilters(next);
                            }}
                            placeholder="Value"
                          />
                        )
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewBuilderFilters(viewBuilderFilters.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={viewBuilderIsDefault}
                  onChange={(e) => setViewBuilderIsDefault(e.target.checked)}
                />
                Set as default view
              </label>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowViewBuilder(false);
                  setEditingView(null);
                }}
                disabled={viewBuilderSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!viewBuilderName.trim() || viewBuilderSaving}
                onClick={async () => {
                  if (!viewBuilderName.trim()) return;
                  setViewBuilderSaving(true);
                  try {
                    const viewData = {
                      name: viewBuilderName.trim(),
                      description: viewBuilderDescription.trim() || undefined,
                      filters: viewBuilderFilters.filter((f) => f.field && f.operator),
                      isDefault: viewBuilderIsDefault,
                      isSystem: true, // FormBuilder creates system views visible to all users
                    };
                    
                    if (editingView) {
                      await updateView(editingView.id, viewData);
                    } else {
                      await createView(viewData);
                    }
                    
                    refreshViews();
                    setShowViewBuilder(false);
                    setEditingView(null);
                  } catch (err: any) {
                    alert(err?.message || 'Failed to save view');
                  } finally {
                    setViewBuilderSaving(false);
                  }
                }}
              >
                {viewBuilderSaving ? 'Saving...' : editingView ? 'Update View' : 'Create View'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isNew && id && (
        <FormAclModal
          formId={id}
          isOpen={showAclModal}
          onClose={() => setShowAclModal(false)}
          onUpdate={() => refresh()}
        />
      )}
    </Page>
  );
}

export default FormBuilder;
