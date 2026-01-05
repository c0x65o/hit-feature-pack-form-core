/**
 * Lucide icon resolver using wildcard import.
 */
'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';

export type LucideIconComponent = React.ComponentType<{
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}>;

function toPascalFromKebab(name: string): string {
  return String(name || '')
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function normalizeKey(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const val = raw.includes(':') ? raw.split(':', 2)[1] : raw;
  if (!val) return '';
  return val.includes('-') || val.includes('_') || val.includes(' ') ? toPascalFromKebab(val) : val;
}

export function resolveLucideIconStrict(name?: string | null): LucideIconComponent | null {
  const key = normalizeKey(String(name || '').trim());
  if (!key) {
    return null;
  }
  const Icon = (LucideIcons as unknown as Record<string, LucideIconComponent>)[key];
  return Icon || null;
}

/**
 * Get list of available icon names for documentation/UI
 */
export function getAvailableIcons(): string[] {
  return Object.keys(LucideIcons).filter(k => typeof (LucideIcons as unknown as Record<string, unknown>)[k] === 'function').sort();
}
