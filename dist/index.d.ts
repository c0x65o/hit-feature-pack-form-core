/**
 * @hit/feature-pack-forms
 *
 * Runtime Forms feature pack: form builder + CRUD entries + search + reference linking.
 *
 * Pages are exported individually for optimal tree-shaking.
 */
export { FormList, FormListPage, FormBuilder, FormBuilderPage, EntryList, EntryListPage, EntryDetail, EntryDetailPage, EntryEdit, EntryEditPage, } from './pages/index';
export * from './hooks/index';
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