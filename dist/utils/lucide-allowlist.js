/**
 * Lucide icon resolver using wildcard import.
 */
'use client';
import * as LucideIcons from 'lucide-react';
function toPascalFromKebab(name) {
    return String(name || '')
        .trim()
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
}
function normalizeKey(name) {
    const raw = String(name || '').trim();
    if (!raw)
        return '';
    const val = raw.includes(':') ? raw.split(':', 2)[1] : raw;
    if (!val)
        return '';
    return val.includes('-') || val.includes('_') || val.includes(' ') ? toPascalFromKebab(val) : val;
}
export function resolveLucideIconStrict(name) {
    const key = normalizeKey(String(name || '').trim());
    if (!key) {
        return null;
    }
    const Icon = LucideIcons[key];
    return Icon || null;
}
/**
 * Get list of available icon names for documentation/UI
 */
export function getAvailableIcons() {
    return Object.keys(LucideIcons).filter(k => typeof LucideIcons[k] === 'function').sort();
}
//# sourceMappingURL=lucide-allowlist.js.map