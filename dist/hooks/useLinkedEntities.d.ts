export type LinkedEntityKind = string;
export interface LinkedFormInfo {
    formId: string;
    formName: string;
    formSlug: string;
    entityFieldKey: string;
    count: number;
}
export declare function useLinkedForms(entity: {
    kind: LinkedEntityKind;
    id: string;
} | null | undefined): {
    items: LinkedFormInfo[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
export interface LinkedEntriesOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface LinkedEntriesResponse {
    items: Array<{
        id: string;
        formId: string;
        createdByUserId: string;
        updatedByUserId: string | null;
        data: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    fields: any[];
    listConfig: any;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
export declare function useLinkedFormEntries(args: {
    formId: string;
    entity: {
        kind: LinkedEntityKind;
        id: string;
    };
    entityFieldKey: string;
    options?: LinkedEntriesOptions;
} | null | undefined): {
    data: LinkedEntriesResponse | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
//# sourceMappingURL=useLinkedEntities.d.ts.map