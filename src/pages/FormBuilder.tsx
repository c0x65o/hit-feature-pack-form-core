'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, UploadCloud, ClipboardList, FileText, Share2 } from 'lucide-react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import {
  FieldType,
  FormScope,
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

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<FormScope>('private');

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
      setScope(form.scope);
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
          scope,
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
        scope,
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
                    { value: 'select', label: 'Select' },
                    { value: 'checkbox', label: 'Checkbox' },
                    { value: 'reference', label: 'Reference' },
                    { value: 'entity_reference', label: 'Entity Reference' },
                  ]}
                />
              </div>

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
