'use client';

import React from 'react';
import { FormList } from '../widgets/FormList';
import { FormBuilder } from '../widgets/FormBuilder';
import { EntryList } from '../widgets/EntryList';
import { EntryDetail } from '../widgets/EntryDetail';
import { EntryEdit } from '../widgets/EntryEdit';

export type PackListWidgetRendererArgs = {
  entityKey: string;
  uiSpec: any;
  listSpec: any;
  navigate?: (path: string) => void;
  ui: any;
  platform: string;
  params: Record<string, string>;
};

export type PackDetailWidgetRendererArgs = {
  entityKey: string;
  uiSpec: any;
  detailSpec: any;
  navigate?: (path: string) => void;
  ui: any;
  platform: string;
  params: Record<string, string>;
};

export type PackFormWidgetRendererArgs = {
  entityKey: string;
  uiSpec: any;
  formSpec: any;
  navigate?: (path: string) => void;
  ui: any;
  platform: string;
  params: Record<string, string>;
};

export type PackContrib = {
  listWidgets?: Record<string, (args: PackListWidgetRendererArgs) => React.ReactNode>;
  detailWidgets?: Record<string, (args: PackDetailWidgetRendererArgs) => React.ReactNode>;
  formWidgets?: Record<string, (args: PackFormWidgetRendererArgs) => React.ReactNode>;
};

function resolveMode(spec: any): string {
  const mode = String(spec?.widgetMode || spec?.mode || '').trim();
  return mode;
}

function runtimeFormsWidget(args: {
  mode: string;
  params: Record<string, string>;
  navigate?: (path: string) => void;
  ui: any;
}): React.ReactNode {
  const { mode, params, navigate, ui } = args;
  const { Alert } = ui || {};
  const formId = String(params?.id || '').trim();
  const entryId = String(params?.entryId || '').trim();

  if (mode.startsWith('entries') && !formId) {
    return Alert ? (
      <Alert variant="warning" title="Missing form id">
        This route requires a form id to render entries.
      </Alert>
    ) : (
      <div>Missing form id.</div>
    );
  }

  if (mode === 'entries.detail' && !entryId) {
    return Alert ? (
      <Alert variant="warning" title="Missing entry id">
        This route requires an entry id to render the entry detail.
      </Alert>
    ) : (
      <div>Missing entry id.</div>
    );
  }

  switch (mode) {
    case 'forms.list':
      return <FormList onNavigate={navigate} />;
    case 'forms.builder':
      return <FormBuilder id={formId || undefined} onNavigate={navigate} />;
    case 'entries.list':
      return <EntryList id={formId || undefined} onNavigate={navigate} />;
    case 'entries.detail':
      return <EntryDetail id={formId || undefined} entryId={entryId || undefined} onNavigate={navigate} />;
    case 'entries.edit':
      return <EntryEdit id={formId || undefined} entryId={entryId || undefined} onNavigate={navigate} />;
    default:
      return Alert ? (
        <Alert variant="warning" title="Unsupported forms widget mode">
          Unknown widget mode: {mode || 'missing'}.
        </Alert>
      ) : (
        <div>Unsupported forms widget mode: {mode || 'missing'}.</div>
      );
  }
}

export const contrib: PackContrib = {
  listWidgets: {
    'forms.runtime': ({ listSpec, navigate, ui, params }) =>
      runtimeFormsWidget({ mode: resolveMode(listSpec) || 'forms.list', params, navigate, ui }),
  },
  detailWidgets: {
    'forms.runtime': ({ detailSpec, navigate, ui, params }) =>
      runtimeFormsWidget({ mode: resolveMode(detailSpec) || 'entries.detail', params, navigate, ui }),
  },
  formWidgets: {
    'forms.runtime': ({ formSpec, navigate, ui, params }) =>
      runtimeFormsWidget({ mode: resolveMode(formSpec) || 'entries.edit', params, navigate, ui }),
  },
};

export default contrib;
