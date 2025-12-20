type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
export type MetricsViewMetadata = {
    panels?: Array<{
        title?: string;
        metricKey: string;
        bucket?: Bucket;
        agg?: Agg;
        days?: number;
        dimensions?: Record<string, string | number | boolean | null>;
    }>;
};
export declare function MetricsPanel(props: {
    entityKind: string;
    entityId: string;
    metrics: MetricsViewMetadata;
}): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=MetricsPanel.d.ts.map