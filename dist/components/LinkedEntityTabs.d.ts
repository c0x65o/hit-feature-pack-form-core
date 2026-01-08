import React from 'react';
import { type LinkedEntityKind } from '../hooks/useLinkedEntities';
export interface LinkedEntityTabsProps {
    entity: {
        kind: LinkedEntityKind;
        id: string;
    };
    overview: React.ReactNode;
    overviewLabel?: string;
    includeZeroCountTabs?: boolean;
    pageSize?: number;
    onNavigate?: (path: string) => void;
    rowHref?: (args: {
        formId: string;
        entryId: string;
    }) => string;
}
export declare function LinkedEntityTabs({ entity, overview, overviewLabel, includeZeroCountTabs, pageSize, onNavigate, rowHref, }: LinkedEntityTabsProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=LinkedEntityTabs.d.ts.map