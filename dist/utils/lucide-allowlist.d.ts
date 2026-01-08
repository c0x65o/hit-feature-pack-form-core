import React from 'react';
export type LucideIconComponent = React.ComponentType<{
    size?: number | string;
    color?: string;
    className?: string;
    style?: React.CSSProperties;
}>;
export declare function resolveLucideIconStrict(name?: string | null): LucideIconComponent | null;
/**
 * Get list of available icon names for documentation/UI
 */
export declare function getAvailableIcons(): string[];
//# sourceMappingURL=lucide-allowlist.d.ts.map