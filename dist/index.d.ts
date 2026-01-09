/**
 * @hit/feature-pack-form-core
 *
 * Runtime Forms feature pack: form builder + CRUD entries + search + reference linking.
 *
 * Pages are exported individually for optimal tree-shaking.
 */
export { FormList, default as FormListPage } from './pages/FormList';
export { FormBuilder, default as FormBuilderPage } from './pages/FormBuilder';
export { EntryList, default as EntryListPage } from './pages/EntryList';
export { EntryDetail, default as EntryDetailPage } from './pages/EntryDetail';
export { EntryEdit, default as EntryEditPage } from './pages/EntryEdit';
export { useForms, useForm, useFormMutations, useEntries, useEntry, useEntryMutations, type NavPlacement, type FieldType, type FormRecord, type FormFieldRecord, type FormVersionRecord, type FormEntryRecord, type PaginatedResponse, } from './hooks/useForms';
export { useLinkedForms, useLinkedFormEntries, type LinkedEntityKind, type LinkedFormInfo, type LinkedEntriesOptions, type LinkedEntriesResponse, } from './hooks/useLinkedEntities';
export { navContributions as nav } from './nav';
export declare const FORM_PERMISSIONS: {
    readonly READ: "READ";
    readonly WRITE: "WRITE";
    readonly DELETE: "DELETE";
    readonly MANAGE_ACL: "MANAGE_ACL";
};
export type FormPermission = keyof typeof FORM_PERMISSIONS;
export { FormAclModal } from './components/FormAclModal';
export { LinkedEntityTabs } from './components/LinkedEntityTabs';
export { MetricsPanel, type MetricsViewMetadata } from './components/MetricsPanel';
//# sourceMappingURL=index.d.ts.map