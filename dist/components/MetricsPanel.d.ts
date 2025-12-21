type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
export type MetricsViewMetadata = {
    panels?: Array<{
        title?: string;
        metricKey: string;
        bucket?: Bucket;
        agg?: Agg;
        /** Optional grouping in the UI (collapsible sections). */
        groupKey?: string;
        groupLabel?: string;
        /** Lucide icon name, e.g. "Users", "Heart", "DollarSign". */
        groupIcon?: string;
        /** If true, this panel drives the group's header "current" value. */
        groupPrimary?: boolean;
        /**
         * If set, display as a cumulative running total:
         * - range: starts at 0 at the beginning of the selected range
         * - all_time: starts at cumulative total since 2000-01-01 up to the start of range
         */
        cumulative?: 'range' | 'all_time';
        dimensions?: Record<string, string | number | boolean | null>;
        /**
         * When entityKind is "project", overlay project activity timeline on the chart.
         * Defaults to true for project pages (unless explicitly set to false).
         */
        timelineOverlay?: boolean;
    }>;
};
export declare function MetricsPanel(props: {
    entityKind: string;
    entityId?: string;
    entityIds?: string[];
    metrics: MetricsViewMetadata;
}): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=MetricsPanel.d.ts.map