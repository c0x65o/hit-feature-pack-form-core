export type NavPlacement = 'under_forms' | 'top_level';
export type FieldType = 'text' | 'url' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox' | 'reference' | 'entity_reference';
export interface FormRecord {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublished: boolean;
    navShow: boolean;
    navPlacement: NavPlacement;
    navGroup: string;
    navWeight: number;
    navLabel: string | null;
    navIcon: string | null;
    navParentPath: string | null;
    aclEnabled: boolean;
    ownerUserId: string;
    createdAt: string;
    updatedAt: string;
}
export interface FormFieldRecord {
    id: string;
    key: string;
    label: string;
    type: FieldType;
    order: number;
    hidden: boolean;
    required: boolean;
    showInTable: boolean;
    config: any;
    defaultValue: any;
}
export interface FormVersionRecord {
    id: string;
    formId: string;
    version: number;
    status: 'draft' | 'published';
    listConfig?: any;
    fields: FormFieldRecord[];
}
export interface FormEntryRecord {
    id: string;
    formId: string;
    createdByUserId: string;
    updatedByUserId: string | null;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
/**
 * List forms
 * @param adminMode - If true, lists ALL forms (requires admin role). Otherwise lists only forms user has READ ACL for.
 */
export declare function useForms(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    adminMode?: boolean;
}): {
    data: PaginatedResponse<FormRecord> | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
export declare function useForm(formId: string | undefined): {
    form: FormRecord | null;
    version: FormVersionRecord | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
export declare function useFormMutations(): {
    createForm: (payload: {
        name: string;
        slug?: string;
        description?: string;
        navShow?: boolean;
        navPlacement?: NavPlacement;
        navGroup?: string;
        navWeight?: number;
        navLabel?: string;
        navIcon?: string;
        navParentPath?: string;
    }) => Promise<FormRecord>;
    updateForm: (id: string, payload: Partial<{
        name: string;
        description: string;
    }>) => Promise<FormRecord>;
    deleteForm: (id: string) => Promise<void>;
    saveForm: (id: string, payload: Partial<{
        name: string;
        description: string;
        navShow: boolean;
        navPlacement: NavPlacement;
        navGroup: string;
        navWeight: number;
        navLabel: string;
        navIcon: string;
        navParentPath: string;
        draft: {
            fields: Array<Partial<FormFieldRecord>>;
            listConfig?: any;
        };
    }>) => Promise<{
        success: boolean;
    }>;
    saveDraftFields: (id: string, payload: {
        fields: Array<Partial<FormFieldRecord>>;
        listConfig?: any;
    }) => Promise<{
        success: boolean;
    }>;
    loading: boolean;
    error: Error | null;
};
export declare function useEntries(options: {
    formId: string;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}): {
    data: PaginatedResponse<FormEntryRecord> | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
export declare function useEntry(formId: string, entryId: string | undefined): {
    entry: FormEntryRecord | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};
export declare function useEntryMutations(formId: string): {
    createEntry: (data: Record<string, unknown>) => Promise<FormEntryRecord>;
    updateEntry: (entryId: string, data: Record<string, unknown>) => Promise<FormEntryRecord>;
    deleteEntry: (entryId: string) => Promise<void>;
    loading: boolean;
    error: Error | null;
};
//# sourceMappingURL=useForms.d.ts.map