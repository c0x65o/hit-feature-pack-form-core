'use client';

import React from 'react';
import { LinkedEntityTabs } from '../components/LinkedEntityTabs';

function asRecord(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as any) : null;
}

export type LinkedEntityTabsExtraSpec = {
  kind: 'linkedEntityTabs';
  entityKind?: string;
  entityIdField?: string;
  overviewLabel?: string;
  includeZeroCountTabs?: boolean;
  pageSize?: number;
};

export function entityKeyToFormsEntityKind(entityKey: string): string {
  return String(entityKey || '').trim().replace(/\./g, '_');
}

export function splitLinkedEntityTabsExtra(extrasAny: unknown): {
  linkedEntityTabs: LinkedEntityTabsExtraSpec | null;
  extras: any[];
} {
  const extras = Array.isArray(extrasAny) ? extrasAny : [];
  let linked: LinkedEntityTabsExtraSpec | null = null;
  const rest: any[] = [];

  for (const x of extras) {
    const r = asRecord(x);
    const kind = String(r?.kind || '');
    if (!linked && kind === 'linkedEntityTabs') {
      linked = r as any;
      continue;
    }
    rest.push(x);
  }

  return { linkedEntityTabs: linked, extras: rest };
}

export function wrapWithLinkedEntityTabsIfConfigured(args: {
  linkedEntityTabs: LinkedEntityTabsExtraSpec | null;
  entityKey: string;
  record: any;
  navigate?: (path: string) => void;
  overview: React.ReactNode;
}): React.ReactNode {
  const spec = args.linkedEntityTabs;
  if (!spec) return args.overview;
  if (!args.navigate) return args.overview; // LinkedEntityTabs requires onNavigate

  const entityKind = String(spec.entityKind || entityKeyToFormsEntityKind(args.entityKey) || 'project').trim();
  const entityIdField = String(spec.entityIdField || 'id').trim() || 'id';
  const entityId = String((args.record as any)?.[entityIdField] ?? (args.record as any)?.id ?? '').trim();
  if (!entityKind || !entityId) return args.overview;

  const overviewLabel = spec.overviewLabel ? String(spec.overviewLabel) : undefined;
  const includeZeroCountTabs =
    typeof spec.includeZeroCountTabs === 'boolean' ? Boolean(spec.includeZeroCountTabs) : undefined;
  const pageSize = Number.isFinite(Number(spec.pageSize)) ? Number(spec.pageSize) : undefined;

  return (
    <LinkedEntityTabs
      entity={{ kind: entityKind, id: entityId }}
      overview={args.overview}
      overviewLabel={overviewLabel}
      includeZeroCountTabs={includeZeroCountTabs}
      pageSize={pageSize}
      onNavigate={args.navigate}
    />
  );
}

